/**
 * AgentForge pipeline runtime.
 *
 * Walks a Pipeline (nodes + edges) starting from the `input` node and
 * executes each node in turn. LLM calls are delegated to a pluggable
 * `LLMCaller` so the same executor works in production (Anthropic SDK)
 * and in tests (deterministic mock).
 *
 * Supported node kinds in v1: input, output, llm_agent, decision, loop
 * (pass-through with revisit cap), parallel→agents→aggregator (fork-join).
 *
 * Not yet supported: human (would need UI flow), tool (would need a
 * separate tool registry). These node kinds raise a clear error so
 * partial pipelines fail loudly rather than silently skip.
 *
 * The executor is event-emitting: every interesting transition is
 * dispatched through `onEvent`. This drives both the SSE wire format on
 * /api/run and the live canvas decorations on the client.
 */

import type {
  Pipeline,
  FlowNode,
  FlowEdge,
  AggregatorConfig,
} from '@/types/pipeline';
import {
  evaluateExpression,
  parseExpression,
  collectRefs,
  type Value,
} from './expression';

// ─── Event types ─────────────────────────────────────────────────────────

export type ExecutionEvent =
  | { type: 'pipeline:start'; timestamp: number; input: string }
  | { type: 'pipeline:complete'; timestamp: number; output: unknown }
  | { type: 'pipeline:error'; timestamp: number; error: string; nodeId?: string }
  | { type: 'node:start'; timestamp: number; nodeId: string }
  | { type: 'node:partial'; timestamp: number; nodeId: string; text: string }
  | { type: 'node:complete'; timestamp: number; nodeId: string; output: unknown }
  | { type: 'node:error'; timestamp: number; nodeId: string; error: string }
  | { type: 'edge:traverse'; timestamp: number; edgeId: string; from: string; to: string };

export type ExecutionStatus = 'idle' | 'running' | 'complete' | 'error' | 'aborted';

// ─── Pluggable LLM caller ────────────────────────────────────────────────

export interface LLMCallParams {
  system: string;
  user: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface LLMCaller {
  /**
   * Call the LLM and return its full response text. If `onPartial` is
   * provided, the implementation should emit incremental chunks for
   * streaming UIs.
   */
  call(params: LLMCallParams, onPartial?: (text: string) => void): Promise<string>;
}

// ─── Errors ──────────────────────────────────────────────────────────────

export class ExecutionError extends Error {
  constructor(message: string, public nodeId?: string) {
    super(message);
    this.name = 'ExecutionError';
  }
}

// ─── Executor ────────────────────────────────────────────────────────────

export interface ExecutorOptions {
  llm: LLMCaller;
  onEvent: (event: ExecutionEvent) => void;
  signal?: AbortSignal;
  /** Hard cap on per-node visits — defends against unintended infinite
   * loops. Per-node `loopConfig.maxIterations` overrides this if higher. */
  defaultMaxVisits?: number;
}

export class PipelineExecutor {
  private nodes: Map<string, FlowNode>;
  private outgoing: Map<string, FlowEdge[]>;

  /** `{role.field}` → current value, for expression evaluation. */
  private context: Record<string, Value> = {};

  /** Number of times each node has been entered. */
  private visits: Record<string, number> = {};

  constructor(public pipeline: Pipeline, private options: ExecutorOptions) {
    this.nodes = new Map(pipeline.nodes.map((n) => [n.id, n]));
    this.outgoing = new Map();
    for (const e of pipeline.edges) {
      if (!this.outgoing.has(e.source)) this.outgoing.set(e.source, []);
      this.outgoing.get(e.source)!.push(e);
    }
  }

  // ── Public entry ──────────────────────────────────────────────────────

  async execute(input: string): Promise<unknown> {
    const inputNode = this.findNodeOfType('input');
    if (!inputNode) {
      throw new ExecutionError('Pipeline has no `input` node');
    }
    this.context['input.text'] = input;
    this.emit({ type: 'pipeline:start', timestamp: Date.now(), input });

    try {
      const output = await this.run(inputNode, input);
      this.emit({ type: 'pipeline:complete', timestamp: Date.now(), output });
      return output;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      const nodeId = err instanceof ExecutionError ? err.nodeId : undefined;
      this.emit({ type: 'pipeline:error', timestamp: Date.now(), error: msg, nodeId });
      throw err;
    }
  }

  // ── Core walk ─────────────────────────────────────────────────────────

  private async run(node: FlowNode, upstreamValue: unknown): Promise<unknown> {
    this.checkAborted();
    this.recordVisit(node);
    this.emit({ type: 'node:start', timestamp: Date.now(), nodeId: node.id });

    let result: unknown;
    let nextEdge: FlowEdge | undefined;

    try {
      switch (node.type) {
        case 'input':
          result = upstreamValue;
          nextEdge = this.firstOutgoing(node);
          break;

        case 'output':
          result = upstreamValue;
          this.emit({ type: 'node:complete', timestamp: Date.now(), nodeId: node.id, output: result });
          return result;

        case 'llm_agent':
          result = await this.executeAgent(node, upstreamValue, this.context);
          nextEdge = this.firstOutgoing(node);
          break;

        case 'decision': {
          result = upstreamValue;
          const cfg = node.data.decisionConfig;
          if (!cfg) throw new ExecutionError('Decision node has no config', node.id);
          const cond = this.evaluate(cfg.condition, this.context, node.id);
          const handle = cond ? 'true' : 'false';
          nextEdge = this.outgoing
            .get(node.id)
            ?.find((e) => e.sourceHandle === handle);
          if (!nextEdge) {
            throw new ExecutionError(
              `Decision "${node.data.label}" has no ${handle} edge`,
              node.id
            );
          }
          break;
        }

        case 'loop': {
          // Loop nodes are pass-through annotations in v1. The actual cycle
          // is created by decision back-edges. We honor maxIterations as a
          // visit cap and check breakCondition on each (re)entry to allow
          // early exit when the cycle is structured to revisit the loop.
          result = upstreamValue;
          const cfg = node.data.loopConfig;
          if (cfg?.breakCondition && this.visits[node.id] > 1) {
            // Already iterated at least once — check for early break.
            if (this.evaluate(cfg.breakCondition, this.context, node.id)) {
              this.emit({
                type: 'node:complete',
                timestamp: Date.now(),
                nodeId: node.id,
                output: { broke_early_at_iteration: this.visits[node.id] },
              });
              // No further forward action — caller cycle should naturally exit.
              // We still need an outgoing edge to advance.
            }
          }
          nextEdge = this.firstOutgoing(node);
          break;
        }

        case 'parallel': {
          const aggregator = this.findAggregatorAfter(node);
          if (!aggregator) {
            throw new ExecutionError(
              `Parallel "${node.data.label}" has no downstream aggregator. Insert an aggregator node before the next merge point.`,
              node.id
            );
          }
          result = await this.executeParallelBlock(node, aggregator, upstreamValue);
          // After parallel, jump past the aggregator.
          nextEdge = this.firstOutgoing(aggregator);
          if (!nextEdge) {
            throw new ExecutionError(
              `Aggregator "${aggregator.data.label}" has no outgoing edge`,
              aggregator.id
            );
          }
          break;
        }

        case 'aggregator':
          // Reached an aggregator outside a parallel block — pass through.
          // (Well-formed pipelines route through the parallel path which
          // consumes the aggregator implicitly; this branch is for safety.)
          result = upstreamValue;
          nextEdge = this.firstOutgoing(node);
          break;

        case 'human':
          throw new ExecutionError(
            `Human-in-the-loop nodes aren't supported by the runtime yet`,
            node.id
          );

        case 'tool':
          throw new ExecutionError(
            `Tool nodes aren't supported by the runtime yet`,
            node.id
          );

        default:
          throw new ExecutionError(`Unknown node type: ${node.type}`, node.id);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.emit({ type: 'node:error', timestamp: Date.now(), nodeId: node.id, error: msg });
      throw err;
    }

    this.emit({ type: 'node:complete', timestamp: Date.now(), nodeId: node.id, output: result });

    if (!nextEdge) {
      throw new ExecutionError(`Node "${node.data.label}" has no outgoing edge`, node.id);
    }
    this.emit({
      type: 'edge:traverse',
      timestamp: Date.now(),
      edgeId: nextEdge.id,
      from: nextEdge.source,
      to: nextEdge.target,
    });

    const nextNode = this.nodes.get(nextEdge.target);
    if (!nextNode) {
      throw new ExecutionError(`Edge points to non-existent node: ${nextEdge.target}`);
    }
    return this.run(nextNode, result);
  }

  // ── Agent execution ───────────────────────────────────────────────────

  private async executeAgent(
    node: FlowNode,
    upstreamValue: unknown,
    context: Record<string, Value>
  ): Promise<unknown> {
    const cfg = node.data.agentConfig;
    if (!cfg) throw new ExecutionError(`Agent has no config`, node.id);

    const userMessage = this.serializeAgentInput(upstreamValue);

    this.checkAborted();
    const text = await this.options.llm.call(
      {
        system: cfg.systemPrompt,
        user: userMessage,
        model: cfg.model,
        temperature: cfg.temperature,
        maxTokens: cfg.maxTokens,
      },
      (partial) => {
        this.emit({
          type: 'node:partial',
          timestamp: Date.now(),
          nodeId: node.id,
          text: partial,
        });
      }
    );

    // Always expose the raw text under `${role}.output`.
    context[`${cfg.role}.output`] = text;

    // If outputSchema is declared, parse JSON and expose each field.
    if (cfg.outputSchema && cfg.outputSchema.length > 0) {
      const parsed = tryExtractJSON(text);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const field of cfg.outputSchema) {
          if (field.name in parsed) {
            // Coerce array/object/null/primitives into Value-compatible shape
            const v = (parsed as Record<string, unknown>)[field.name];
            context[`${cfg.role}.${field.name}`] = coerceToValue(v);
          }
        }
      }
      // If parse failed, leave the structured fields unset — downstream
      // {{role.field}} references will resolve to null and likely fail
      // their conditions, which is the right behavior (loud failure beats
      // silent garbage).
    }

    return text;
  }

  /** Convert whatever the upstream produced into a string suitable for
   * dropping into a user message. Strings pass through; objects/arrays
   * are pretty-printed JSON. */
  private serializeAgentInput(value: unknown): string {
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  // ── Parallel + aggregator ─────────────────────────────────────────────

  /**
   * Fork-join: run the chain from `parallel`'s first downstream node up
   * through (and excluding) `aggregator`, N times in parallel, each with
   * its own context copy. Then apply the aggregator's strategy to merge.
   */
  private async executeParallelBlock(
    parallel: FlowNode,
    aggregator: FlowNode,
    upstreamValue: unknown
  ): Promise<unknown> {
    const cfg = parallel.data.parallelConfig;
    if (!cfg) throw new ExecutionError('Parallel has no config', parallel.id);

    const N = cfg.numParallel;
    if (N < 1) {
      throw new ExecutionError(`numParallel must be >= 1, got ${N}`, parallel.id);
    }

    this.emit({ type: 'node:complete', timestamp: Date.now(), nodeId: parallel.id, output: { fanout: N } });

    const branches = await Promise.all(
      Array.from({ length: N }, (_, i) =>
        this.executeBranch(parallel, aggregator, upstreamValue, i)
      )
    );

    this.emit({ type: 'node:start', timestamp: Date.now(), nodeId: aggregator.id });
    const result = this.applyAggregator(aggregator, branches);
    this.emit({ type: 'node:complete', timestamp: Date.now(), nodeId: aggregator.id, output: result });

    // Merge the WINNING branch's context back into the main context, so
    // downstream {{role.field}} refs still resolve correctly. For 'all'
    // / 'concat' strategies, no single branch wins — we merge the FIRST
    // branch's context as a reasonable default (the spec author should
    // use 'best' or 'first' if they care about a specific branch's vars).
    const winnerIdx = result.winnerIndex ?? 0;
    Object.assign(this.context, branches[winnerIdx]?.context ?? {});

    return result.value;
  }

  private async executeBranch(
    parallel: FlowNode,
    aggregator: FlowNode,
    input: unknown,
    index: number
  ): Promise<BranchResult> {
    const branchContext: Record<string, Value> = {
      ...this.context,
      'parallel.index': index,
    };

    // Walk from parallel → aggregator, executing each agent we encounter.
    // The branch terminates when we reach the aggregator (which we don't
    // execute here — applyAggregator handles it).
    let current = this.firstDownstream(parallel);
    if (!current) throw new ExecutionError('Parallel has no downstream node', parallel.id);

    let value: unknown = input;
    const maxBranchSteps = 32; // safety
    let steps = 0;

    while (current.id !== aggregator.id) {
      this.checkAborted();
      if (++steps > maxBranchSteps) {
        throw new ExecutionError(
          `Branch ${index} exceeded ${maxBranchSteps} steps without reaching aggregator`,
          current.id
        );
      }
      // Branch start event — uses synthetic nodeId so the UI can show
      // per-branch progress without conflating with main-flow visits.
      this.emit({ type: 'node:start', timestamp: Date.now(), nodeId: `${current.id}#${index}` });
      try {
        if (current.type === 'llm_agent') {
          value = await this.executeAgent(current, value, branchContext);
        } else {
          throw new ExecutionError(
            `Parallel branches only support llm_agent nodes (saw "${current.type}")`,
            current.id
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.emit({
          type: 'node:error',
          timestamp: Date.now(),
          nodeId: `${current.id}#${index}`,
          error: msg,
        });
        throw err;
      }
      this.emit({
        type: 'node:complete',
        timestamp: Date.now(),
        nodeId: `${current.id}#${index}`,
        output: value,
      });

      const next = this.firstDownstream(current);
      if (!next) {
        throw new ExecutionError(`Branch ${index} dead-ended at "${current.data.label}"`, current.id);
      }
      current = next;
    }

    return { output: value, context: branchContext, index };
  }

  private applyAggregator(
    node: FlowNode,
    branches: BranchResult[]
  ): { value: unknown; winnerIndex?: number } {
    const cfg = node.data.aggregatorConfig;
    if (!cfg) throw new ExecutionError('Aggregator has no config', node.id);

    switch (cfg.strategy) {
      case 'all':
        return { value: branches.map((b) => b.output) };

      case 'concat':
        return {
          value: branches.map((b) => String(b.output ?? '')).join('\n\n'),
        };

      case 'first':
        return { value: branches[0]?.output, winnerIndex: 0 };

      case 'best': {
        const winner = pickBest(branches, cfg);
        return { value: winner.branch.output, winnerIndex: winner.index };
      }

      case 'vote': {
        const winner = pickByVote(branches, cfg);
        return { value: winner.branch.output, winnerIndex: winner.index };
      }
    }
  }

  // ── Graph helpers ─────────────────────────────────────────────────────

  private findNodeOfType(type: string): FlowNode | undefined {
    return this.pipeline.nodes.find((n) => n.type === type);
  }

  private firstOutgoing(node: FlowNode): FlowEdge | undefined {
    return this.outgoing.get(node.id)?.[0];
  }

  private firstDownstream(node: FlowNode): FlowNode | undefined {
    const e = this.firstOutgoing(node);
    if (!e) return undefined;
    return this.nodes.get(e.target);
  }

  /** Forward DFS from `parallel` until we reach an aggregator. */
  private findAggregatorAfter(parallel: FlowNode): FlowNode | undefined {
    const visited = new Set<string>();
    const stack: string[] = [parallel.id];
    while (stack.length) {
      const id = stack.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      const node = this.nodes.get(id);
      if (node && node.type === 'aggregator' && id !== parallel.id) return node;
      const out = this.outgoing.get(id);
      if (out) for (const e of out) stack.push(e.target);
    }
    return undefined;
  }

  // ── Bookkeeping ───────────────────────────────────────────────────────

  private recordVisit(node: FlowNode) {
    this.visits[node.id] = (this.visits[node.id] ?? 0) + 1;
    const cap = this.maxVisitsFor(node);
    if (this.visits[node.id] > cap) {
      throw new ExecutionError(
        `Node "${node.data.label}" exceeded ${cap} visits — possible infinite loop`,
        node.id
      );
    }
  }

  private maxVisitsFor(node: FlowNode): number {
    if (node.type === 'loop' && node.data.loopConfig) {
      return node.data.loopConfig.maxIterations + 1;
    }
    return this.options.defaultMaxVisits ?? 50;
  }

  private evaluate(expr: string, ctx: Record<string, Value>, nodeId?: string): boolean {
    if (!expr.trim()) return false;
    // Surface syntax errors as ExecutionErrors at evaluation time so the
    // UI can blame the right node.
    const parsed = parseExpression(expr);
    if (parsed.errors.length > 0) {
      const detail = parsed.errors.map((e) => `${e.message} at ${e.pos}`).join('; ');
      throw new ExecutionError(`Invalid expression "${expr}": ${detail}`, nodeId);
    }
    const refs = collectRefs(parsed.ast);
    const missing = refs.filter((r) => !(`${r.role}.${r.field}` in ctx));
    if (missing.length > 0) {
      const list = missing.map((r) => `{{${r.role}.${r.field}}}`).join(', ');
      throw new ExecutionError(
        `Expression references undefined variable(s): ${list}. The upstream agent didn't produce these — check its outputSchema and JSON output.`,
        nodeId
      );
    }
    const r = evaluateExpression(expr, ctx);
    return Boolean(r.value);
  }

  private emit(event: ExecutionEvent) {
    this.options.onEvent(event);
  }

  private checkAborted() {
    if (this.options.signal?.aborted) {
      throw new ExecutionError('Execution aborted');
    }
  }
}

// ─── Aggregator strategies ───────────────────────────────────────────────

interface BranchResult {
  output: unknown;
  context: Record<string, Value>;
  index: number;
}

function pickBest(
  branches: BranchResult[],
  cfg: AggregatorConfig
): { branch: BranchResult; index: number } {
  const criterion = cfg.selectionCriteria;
  if (!criterion) {
    // No criterion → first branch wins (defensive default)
    return { branch: branches[0], index: 0 };
  }
  let best = branches[0];
  let bestVal = numericValue(criterion, best.context);
  for (let i = 1; i < branches.length; i++) {
    const v = numericValue(criterion, branches[i].context);
    if (Number.isFinite(v) && (!Number.isFinite(bestVal) || v > bestVal)) {
      bestVal = v;
      best = branches[i];
    }
  }
  return { branch: best, index: best.index };
}

function pickByVote(
  branches: BranchResult[],
  cfg: AggregatorConfig
): { branch: BranchResult; index: number } {
  const criterion = cfg.selectionCriteria;
  if (!criterion) return { branch: branches[0], index: 0 };

  const counts = new Map<string, number>();
  const firstByValue = new Map<string, BranchResult>();
  for (const b of branches) {
    const r = evaluateExpression(criterion, b.context);
    const key = String(r.value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (!firstByValue.has(key)) firstByValue.set(key, b);
  }
  let bestKey = '';
  let bestCount = -1;
  for (const [k, c] of counts) {
    if (c > bestCount) {
      bestCount = c;
      bestKey = k;
    }
  }
  const winner = firstByValue.get(bestKey) ?? branches[0];
  return { branch: winner, index: winner.index };
}

function numericValue(expr: string, ctx: Record<string, Value>): number {
  const r = evaluateExpression(expr, ctx);
  if (typeof r.value === 'number') return r.value;
  if (typeof r.value === 'boolean') return r.value ? 1 : 0;
  if (typeof r.value === 'string') {
    const n = parseFloat(r.value);
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}

// ─── JSON extraction ─────────────────────────────────────────────────────

/**
 * Try to pull a JSON object out of an LLM response. Real models often
 * wrap JSON in ```json fences, follow it with prose, or even just emit
 * loose JSON — we accept all three shapes.
 */
function tryExtractJSON(text: string): unknown | null {
  // ```json or ``` fenced
  const fenced = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)];
  for (const m of fenced) {
    const obj = safeParse(m[1]);
    if (obj && typeof obj === 'object') return obj;
  }
  // First balanced { ... } in the text
  const start = text.indexOf('{');
  if (start >= 0) {
    let depth = 0;
    let inStr: string | null = null;
    for (let i = start; i < text.length; i++) {
      const c = text[i];
      if (inStr) {
        if (c === '\\') {
          i++;
          continue;
        }
        if (c === inStr) inStr = null;
        continue;
      }
      if (c === '"' || c === '\'') {
        inStr = c;
        continue;
      }
      if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) {
          const obj = safeParse(text.slice(start, i + 1));
          if (obj && typeof obj === 'object') return obj;
          break;
        }
      }
    }
  }
  return null;
}

function safeParse(src: string): unknown {
  try {
    return JSON.parse(src.trim());
  } catch {
    return null;
  }
}

function coerceToValue(v: unknown): Value {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v;
  // Arrays and objects can't fit our scalar Value type; serialize so
  // downstream conditions can still string-compare or extract via JSON.
  try {
    return JSON.stringify(v);
  } catch {
    return null;
  }
}
