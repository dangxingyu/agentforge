import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import {
  PipelineExecutor,
  type ExecutionEvent,
  type LLMCaller,
} from '@/lib/executor';
import type { Pipeline } from '@/types/pipeline';

/**
 * Streaming pipeline runner.
 *
 * Body: `{ pipeline: Pipeline, input: string }`.
 * Response: SSE stream of `ExecutionEvent`s, each preceded by `data: ` and
 * followed by `\n\n`. The stream terminates with `data: [DONE]`.
 *
 * Aborts client-side disconnects via the request signal so we don't keep
 * the Anthropic stream alive after the user closes the run panel.
 */
export async function POST(req: NextRequest) {
  let body: { pipeline?: Pipeline; input?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { pipeline, input } = body;
  if (!pipeline || !input) {
    return NextResponse.json(
      { error: 'Body must include `pipeline` and `input`' },
      { status: 400 }
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY not configured on the server' },
      { status: 500 }
    );
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const llm = makeAnthropicCaller(client);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: ExecutionEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Controller closed (client disconnected). Nothing to do.
        }
      };

      const ctrl = new AbortController();
      // Tie the executor's abort signal to the request signal — when the
      // client disconnects, kill the in-flight Anthropic stream too.
      req.signal.addEventListener('abort', () => ctrl.abort());

      const executor = new PipelineExecutor(pipeline, {
        llm,
        onEvent: send,
        signal: ctrl.signal,
      });

      try {
        await executor.execute(input);
      } catch {
        // pipeline:error event has already been emitted by the executor.
      } finally {
        try {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } catch {
          // ignore
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

// ─── Anthropic adapter ───────────────────────────────────────────────────
//
// Maps an LLMCallParams call into the Anthropic Messages API. Streaming
// is used so we can forward incremental chunks to the executor's
// onPartial callback (which in turn becomes node:partial SSE events on
// the wire).

function makeAnthropicCaller(client: Anthropic): LLMCaller {
  return {
    async call({ system, user, model, temperature, maxTokens }, onPartial) {
      // Translate to Anthropic's expected names. Our `model` IDs include a
      // few that aren't strictly Anthropic — defensively coerce unknown
      // models to the Sonnet default so a misconfigured node doesn't kill
      // the whole run.
      const anthropicModel = mapToAnthropicModel(model);

      const stream = await client.messages.stream({
        model: anthropicModel,
        max_tokens: maxTokens,
        temperature,
        system,
        messages: [{ role: 'user', content: user }],
      });

      let full = '';
      for await (const ev of stream) {
        if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') {
          const chunk = ev.delta.text;
          full += chunk;
          onPartial?.(chunk);
        }
      }
      return full;
    },
  };
}

function mapToAnthropicModel(model: string): string {
  // Pass through any model id that already looks Anthropic-shaped.
  if (model.startsWith('claude-')) return model;
  // For OpenAI/Gemini IDs we could call out to those providers, but
  // staying single-vendor for v1: route everything to Sonnet 4.6.
  return 'claude-sonnet-4-6';
}
