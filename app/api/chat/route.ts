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
- **llm_agent**: Any LLM call (specify role, model, system prompt, temperature, max_tokens)
- **parallel**: Fan-out to N parallel instances (numParallel, label)
- **aggregator**: Collect/merge parallel results (strategy: all/best/vote/first/concat)
- **decision**: Branch based on condition (condition, trueLabel, falseLabel)
- **loop**: Iterate until condition met (maxIterations, breakCondition)
- **human**: Human-in-the-loop review (prompt, approvalRequired)
- **tool**: External API or function call (toolName, apiEndpoint)
- **input/output**: Entry/exit points

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

        // Check if there's a pipeline JSON in the response
        const pipelineMatch = fullText.match(/```json\s*(\{[\s\S]*?"type"\s*:\s*"pipeline"[\s\S]*?\})\s*```/);
        if (pipelineMatch) {
          try {
            const parsed = JSON.parse(pipelineMatch[1]);
            if (parsed.pipeline) {
              const pipelineData = JSON.stringify({ type: 'pipeline', pipeline: parsed.pipeline });
              controller.enqueue(encoder.encode(`data: ${pipelineData}\n\n`));
            }
          } catch {
            // ignore parse errors in pipeline extraction
          }
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
