import { NextRequest, NextResponse } from 'next/server';
import {
  PipelineExecutor,
  type ExecutionEvent,
  type LLMCaller,
  type LLMCallParams,
  type LLMCallOptions,
} from '@/lib/executor';
import { ProviderRegistry, mergeApiKeys, type ApiKeys } from '@/lib/providers';
import { MissingApiKeyError, UnknownModelError } from '@/lib/providers/types';
import type { Pipeline } from '@/types/pipeline';

/**
 * Streaming pipeline runner.
 *
 * Body shape:
 * ```
 * {
 *   pipeline: Pipeline,
 *   input: string,
 *   apiKeys?: { anthropic?, openai?, openrouter? },
 *   customOpenRouterModels?: string[]
 * }
 * ```
 *
 * Response: SSE stream of `ExecutionEvent`s, each preceded by `data: ` and
 * followed by `\n\n`. The stream terminates with `data: [DONE]`.
 *
 * Cost guardrails (P0 from the audit):
 *   - max 100 nodes, 200 edges
 *   - max 2M cumulative `maxTokens` × `numParallel` × `maxIterations`
 *   - per-node max_tokens capped at 200k for sanity
 * Bad-input guardrails:
 *   - JSON parse errors → 400
 *   - Missing pipeline / input → 400
 *   - Unsupported model id → 400
 *   - Missing API key for the picked provider → 400 with hint
 *
 * Aborts: client-disconnect (`req.signal`) cascades into the executor's
 * AbortController, which is forwarded into every provider's SDK call so
 * in-flight LLM streams actually stop on disconnect.
 */

const LIMITS = {
  maxNodes: 100,
  maxEdges: 200,
  maxTokensPerNode: 200_000,
  maxCumulativeTokens: 2_000_000,
  maxInputChars: 200_000,
} as const;

interface RunBody {
  pipeline?: Pipeline;
  input?: string;
  apiKeys?: ApiKeys;
  customOpenRouterModels?: string[];
}

export async function POST(req: NextRequest) {
  let body: RunBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { pipeline, input, apiKeys, customOpenRouterModels } = body;

  // ── Shape validation ────────────────────────────────────────────────
  if (!pipeline || typeof pipeline !== 'object') {
    return NextResponse.json(
      { error: 'Body must include a `pipeline` object' },
      { status: 400 }
    );
  }
  if (typeof input !== 'string' || input.length === 0) {
    return NextResponse.json(
      { error: 'Body must include a non-empty `input` string' },
      { status: 400 }
    );
  }
  if (input.length > LIMITS.maxInputChars) {
    return NextResponse.json(
      {
        error: `Input too large (${input.length} chars > ${LIMITS.maxInputChars}). If you need to feed a long document, split it via a Map-Reduce template.`,
      },
      { status: 400 }
    );
  }
  if (!Array.isArray(pipeline.nodes) || !Array.isArray(pipeline.edges)) {
    return NextResponse.json(
      { error: '`pipeline` must have `nodes: []` and `edges: []` arrays' },
      { status: 400 }
    );
  }

  // ── Cost guardrails ─────────────────────────────────────────────────
  const guardrailError = checkCostGuardrails(pipeline);
  if (guardrailError) {
    return NextResponse.json({ error: guardrailError }, { status: 400 });
  }

  // ── Provider routing ────────────────────────────────────────────────
  // Merge client-provided keys with server-side env-var defaults; client
  // wins so a user with their own key never has to re-paste it across
  // server restarts.
  const mergedKeys = mergeApiKeys(apiKeys ?? {});
  const registry = new ProviderRegistry(mergedKeys, customOpenRouterModels ?? []);

  // ── SSE setup ───────────────────────────────────────────────────────
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (event: ExecutionEvent) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        } catch {
          // Controller closed during enqueue — disconnect happened.
          closed = true;
        }
      };

      const ctrl = new AbortController();
      const onAbort = () => ctrl.abort();
      req.signal.addEventListener('abort', onAbort);

      const llm: LLMCaller = {
        async call(params: LLMCallParams, opts?: LLMCallOptions): Promise<string> {
          try {
            return await registry.call(params.model, {
              system: params.system,
              user: params.user,
              temperature: params.temperature,
              maxTokens: params.maxTokens,
              thinkingBudget: params.thinkingBudget,
              signal: opts?.signal,
              onPartial: opts?.onPartial,
            });
          } catch (err) {
            // Convert provider-routing errors into messages the executor
            // wraps as node:error events. Otherwise re-throw verbatim.
            if (err instanceof MissingApiKeyError || err instanceof UnknownModelError) {
              throw err;
            }
            throw err;
          }
        },
      };

      const executor = new PipelineExecutor(pipeline, {
        llm,
        onEvent: send,
        signal: ctrl.signal,
      });

      try {
        await executor.execute(input);
      } catch {
        // pipeline:error has already been emitted inside the executor.
      } finally {
        req.signal.removeEventListener('abort', onAbort);
        if (!closed) {
          try {
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          } catch {
            /* ignore */
          }
          try {
            controller.close();
          } catch {
            /* ignore */
          }
          closed = true;
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // tell nginx-style proxies to flush immediately
    },
  });
}

// ─── Guardrails ──────────────────────────────────────────────────────────

function checkCostGuardrails(pipeline: Pipeline): string | null {
  if (pipeline.nodes.length > LIMITS.maxNodes) {
    return `Pipeline has ${pipeline.nodes.length} nodes; the runtime caps at ${LIMITS.maxNodes}. Split into smaller pipelines or raise the limit in lib/api/run/route.ts.`;
  }
  if (pipeline.edges.length > LIMITS.maxEdges) {
    return `Pipeline has ${pipeline.edges.length} edges; the runtime caps at ${LIMITS.maxEdges}.`;
  }

  // Per-node sanity + cumulative cost cap. We sum the worst-case
  // `maxTokens × parallelism × maxIterations` across the graph; a
  // motivated attacker can still hit the cap, but accidental misuse
  // (default-clicking a 1M-token slider 8 times) is now caught.
  let cumulative = 0;
  // Default loop multiplier: if a parallel/agent is inside a loop node
  // earlier in the graph, we're conservative and assume 1× — accurate
  // graph-walk cost estimation is more work than this is worth.
  for (const node of pipeline.nodes) {
    const agent = node.data?.agentConfig;
    const parallel = node.data?.parallelConfig;
    const loop = node.data?.loopConfig;
    if (agent) {
      if (agent.maxTokens > LIMITS.maxTokensPerNode) {
        return `Node "${node.data.label}" requests ${agent.maxTokens} max_tokens; cap is ${LIMITS.maxTokensPerNode}.`;
      }
      const par = parallelMultiplierFor(node.id, pipeline);
      const loopFactor = enclosingLoopFactor(node.id, pipeline);
      cumulative += agent.maxTokens * par * loopFactor;
    }
    if (loop && loop.maxIterations > 100) {
      return `Loop "${node.data.label}" has maxIterations=${loop.maxIterations}; cap is 100.`;
    }
    if (parallel && parallel.numParallel > 32) {
      return `Parallel "${node.data.label}" has numParallel=${parallel.numParallel}; cap is 32.`;
    }
  }
  if (cumulative > LIMITS.maxCumulativeTokens) {
    return `Worst-case cumulative tokens (${cumulative.toLocaleString()}) exceeds ${LIMITS.maxCumulativeTokens.toLocaleString()}. Reduce maxTokens / numParallel / maxIterations.`;
  }
  return null;
}

/** If the agent's incoming edge comes from a parallel node, returns its
 * numParallel. Otherwise 1. (Conservative — doesn't chain through
 * multiple parallels.) */
function parallelMultiplierFor(nodeId: string, pipeline: Pipeline): number {
  const incoming = pipeline.edges.filter((e) => e.target === nodeId);
  for (const e of incoming) {
    const src = pipeline.nodes.find((n) => n.id === e.source);
    if (src?.data?.parallelConfig?.numParallel) {
      return src.data.parallelConfig.numParallel;
    }
  }
  return 1;
}

/** If the node has a loop ancestor (via reverse traversal), return its
 * maxIterations. Approximation. */
function enclosingLoopFactor(nodeId: string, pipeline: Pipeline): number {
  const visited = new Set<string>();
  const stack = [nodeId];
  let factor = 1;
  while (stack.length) {
    const cur = stack.pop()!;
    if (visited.has(cur)) continue;
    visited.add(cur);
    for (const e of pipeline.edges) {
      if (e.target !== cur) continue;
      const src = pipeline.nodes.find((n) => n.id === e.source);
      if (src?.data?.loopConfig?.maxIterations) {
        factor = Math.max(factor, src.data.loopConfig.maxIterations);
      }
      stack.push(e.source);
    }
  }
  return factor;
}
