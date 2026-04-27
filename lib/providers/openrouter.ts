import OpenAI from 'openai';
import type { LLMProvider, LLMRequest } from './types';

/**
 * OpenRouter provider — talks to OpenRouter's OpenAI-compatible
 * `/v1/chat/completions` endpoint. One API key gives access to ~150
 * models from Anthropic / OpenAI / Google / DeepSeek / Meta / etc.
 *
 * Models are referenced by their OpenRouter id (e.g. "anthropic/claude-sonnet-4-6",
 * "google/gemini-2.5-pro", "deepseek/deepseek-r1"). The IMO25 codebase
 * (github.com/dangxingyu/IMO25, imo_solver/utils/config_utils.py) uses the
 * same pattern — same set of models, same endpoint.
 *
 * Reasoning: OpenRouter exposes a unified `reasoning` parameter for models
 * that support it. We pass `reasoning.max_tokens` when the user has set a
 * thinking budget. For models that don't support reasoning, the parameter
 * is silently dropped by OpenRouter.
 *
 * We add the recommended `HTTP-Referer` and `X-Title` headers for
 * attribution on the OpenRouter dashboard.
 */
export const openrouterProvider: LLMProvider = {
  id: 'openrouter',

  async call(req: LLMRequest, apiKey: string): Promise<string> {
    const client = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://github.com/dangxingyu/agentforge',
        'X-Title': 'AgentForge',
      },
    });

    // OpenRouter accepts extra fields (`reasoning`, `provider`, etc.)
    // that the OpenAI SDK's static types don't know about. We build the
    // typed shape first, then add the OpenRouter-specific extras through
    // a typed-once Record so the spread doesn't lie about its values.
    type CreateParams = Parameters<typeof client.chat.completions.create>[0];
    const baseParams = {
      model: req.model.providerModel,
      messages: [
        { role: 'system', content: req.system },
        { role: 'user', content: req.user },
      ],
      temperature: req.temperature,
      max_tokens: req.maxTokens,
      stream: true as const,
    } satisfies Partial<CreateParams>;

    const extra: Record<string, unknown> = {};
    if (req.thinkingBudget && req.thinkingBudget > 0) {
      extra.reasoning = {
        max_tokens: req.thinkingBudget,
        exclude: false, // include reasoning summary in usage but not in content
      };
    }

    // Build a typed call (so `stream: true` resolves to the streaming
    // overload's return type) and then merge OpenRouter-only fields via
    // a one-line Object.assign — at runtime the SDK forwards unknown
    // body fields verbatim to OpenRouter, which is what we want, but
    // the type system still understands the request returns a Stream.
    const stream = await client.chat.completions.create(
      Object.assign({}, baseParams, extra) as CreateParams & { stream: true },
      { signal: req.signal }
    );

    let full = '';
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        full += delta;
        req.onPartial?.(delta);
      }
    }
    return full;
  },
};
