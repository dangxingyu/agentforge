import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const SYSTEM_PROMPT = `You are AgentForge, an expert AI system architect specializing in LLM agent pipeline design. Your job is to help users design powerful, production-grade agent pipelines.

You understand these pipeline patterns deeply:
- **Divide-and-Conquer**: Decompose problem → parallel sub-solvers → synthesize
- **Parallel-and-Distill**: Generate N solutions in parallel → rank/distill → refine best
- **Generate-Critique-Refine**: Generator → Critic → Refiner loop until quality threshold
- **Map-Reduce**: Map agents over inputs → aggregate/reduce results
- **Tournament/Bracket**: Pairwise comparison elimination to find best
- **Hierarchical Delegation**: Manager agent → specialist sub-agents
- **Iterative Deepening**: Progressive refinement with increasing depth

The available node types in AgentForge:
- **llm_agent**: Any LLM call (role, model, systemPrompt, temperature, maxTokens, outputSchema)
- **parallel**: Fan-out to N parallel instances (numParallel, label)
- **aggregator**: Collect/merge parallel results (strategy: all/best/vote/first/concat)
- **decision**: Branch based on condition (condition, trueLabel, falseLabel)
- **loop**: Iterate until condition met (maxIterations, breakCondition)
- **human**: Human-in-the-loop review (prompt, approvalRequired)
- **tool**: External API or function call (toolName, apiEndpoint)
- **input/output**: Entry/exit points

## Condition expression language — IMPORTANT

Any decision \`condition\`, loop \`breakCondition\`, or aggregator
\`selectionCriteria\` is parsed by AgentForge's expression language.
The supported grammar is:

- Literals: numbers (\`0.8\`, \`-3\`), strings (\`"correct"\` or \`'pass'\`),
  booleans (\`true\` / \`false\`), and \`null\`
- Variable references: \`{{role.field}}\` where \`role\` matches an
  upstream llm_agent's \`role\` and \`field\` is in that agent's \`outputSchema\`
- Comparison: \`==\` \`!=\` \`<\` \`<=\` \`>\` \`>=\`
- Logical: \`&&\` \`||\` \`!\`
- Arithmetic: \`+\` \`-\` \`*\` \`/\` \`%\`
- Parentheses: \`( )\`

**Bare names like \`score >= 0.8\` are rejected.** Always wrap variable
references in \`{{role.field}}\` so the spec is self-checking.

Example: \`{{grader.score}} >= 0.8 && {{grader.verdict}} == "correct"\`

## outputSchema — IMPORTANT

Every llm_agent that produces a value consumed downstream (scores,
verdicts, quality metrics, etc.) must declare an \`outputSchema\`:

\`outputSchema\`: array of \`{ name, type, description?, enumValues? }\`
where \`type\` is \`number | string | boolean | enum | array | object\`.

Example: a grader agent with \`role: "grader"\` whose system prompt says
"Return JSON: {score: float, verdict: pass|fail}" should also declare
\`outputSchema: [{"name":"score","type":"number"},{"name":"verdict","type":"enum","enumValues":["pass","fail"]}]\`,
which lets a downstream decision use \`{{grader.score}} >= 0.8\`.

For aggregator nodes with \`strategy: "best"\` or \`"vote"\`, the
\`selectionCriteria\` must be a single \`{{role.field}}\` reference (the
field whose value picks the winning parallel instance).

## Your conversation flow:
1. When user describes a pipeline, ask 2-3 focused clarifying questions about the key design decisions (e.g., "How many parallel solvers?", "What's the quality threshold?", "Which models should handle each role?")
2. Keep questions concrete and answerable
3. Once you have enough information, say "Perfect, generating your pipeline now..." and then output a JSON block with the pipeline spec

## Pipeline JSON format (output this when ready to generate):
\`\`\`json
{"type":"pipeline","pipeline":{"id":"<id>","name":"<name>","description":"<description>","createdAt":"<ISO>","updatedAt":"<ISO>","nodes":[{"id":"<id>","type":"<nodeKind>","position":{"x":<num>,"y":<num>},"data":{"label":"<label>","description":"<desc>","agentConfig":{"role":"<role>","model":"claude-sonnet-4-6","systemPrompt":"<prompt>","temperature":0.7,"maxTokens":2048}}}],"edges":[{"id":"<id>","source":"<nodeId>","target":"<nodeId>","label":"<optional>","animated":true}]}}
\`\`\`

Position nodes vertically (y increments ~160px per step). Use x=250 for main path, x=600 for branches.
Node IDs should be descriptive (e.g., "input", "solver", "critic", "decision1").
Always include "input" and "output" nodes.

Keep your responses concise. Ask questions as a numbered list. Be direct and helpful.`;

export async function POST(req: NextRequest) {
  const { messages } = await req.json();

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropicStream = await client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages: messages.slice(-20), // keep last 20 messages for context
        });

        let fullText = '';

        for await (const event of anthropicStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            const text = event.delta.text;
            fullText += text;

            const sseData = JSON.stringify({ type: 'text', text });
            controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
          }
        }

        // Try multiple strategies to extract a pipeline JSON from the
        // assistant's response. Claude isn't always consistent: it might
        // emit ```json fences, ``` (no language), or no fence at all.
        const pipeline = extractPipelineJSON(fullText);
        if (pipeline) {
          const pipelineData = JSON.stringify({ type: 'pipeline', pipeline });
          controller.enqueue(encoder.encode(`data: ${pipelineData}\n\n`));
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: errMsg })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

// ─── Pipeline JSON extraction ────────────────────────────────────────────
//
// The assistant might emit:
//   ```json\n{...}\n```        (preferred, with language tag)
//   ```\n{...}\n```            (no language tag)
//   {...}                      (raw, no fence)
// We try each format in order and return the first object whose shape
// looks like a pipeline ({type:"pipeline", pipeline:{...}}).

function extractPipelineJSON(text: string): unknown | null {
  // 1. Fenced blocks (with or without "json" tag)
  const fenced = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)];
  for (const m of fenced) {
    const obj = tryParsePipeline(m[1]);
    if (obj) return obj;
  }

  // 2. Raw JSON object — find the smallest balanced {…} containing
  //    `"type":"pipeline"`. Linear scan with a brace counter.
  const idx = text.indexOf('"type"');
  if (idx >= 0) {
    // Walk backward to find the enclosing `{`
    let depth = 0;
    let start = -1;
    for (let i = idx; i >= 0; i--) {
      if (text[i] === '}') depth++;
      else if (text[i] === '{') {
        if (depth === 0) {
          start = i;
          break;
        }
        depth--;
      }
    }
    if (start >= 0) {
      // Walk forward to find the matching `}`
      depth = 0;
      for (let i = start; i < text.length; i++) {
        if (text[i] === '{') depth++;
        else if (text[i] === '}') {
          depth--;
          if (depth === 0) {
            const obj = tryParsePipeline(text.slice(start, i + 1));
            if (obj) return obj;
            break;
          }
        }
      }
    }
  }

  return null;
}

function tryParsePipeline(src: string): unknown | null {
  try {
    const parsed = JSON.parse(src.trim());
    if (
      parsed &&
      typeof parsed === 'object' &&
      (parsed as { type?: string }).type === 'pipeline' &&
      (parsed as { pipeline?: unknown }).pipeline
    ) {
      return (parsed as { pipeline: unknown }).pipeline;
    }
    return null;
  } catch {
    return null;
  }
}
