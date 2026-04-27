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

    // OpenRouter accepts a `reasoning` parameter on supported models. We
    // pass it via `extra_body` since the OpenAI SDK's typed signature
    // doesn't know about it.
    const extra: Record<string, unknown> = {};
    if (req.thinkingBudget && req.thinkingBudget > 0) {
      extra.reasoning = {
        max_tokens: req.thinkingBudget,
        exclude: false, // include reasoning summary in usage but not in content
      };
    }

    // OpenRouter accepts extra fields (`reasoning`, `provider`, etc.)
    // that the OpenAI SDK's static types don't know about. Built the
    // request with the typed shape, then merged the extras separately.
    const stream = await client.chat.completions.create({
      model: req.model.providerModel,
      messages: [
        { role: 'system', content: req.system },
        { role: 'user', content: req.user },
      ],
      temperature: req.temperature,
      max_tokens: req.maxTokens,
      stream: true,
      ...(extra as Record<string, never>),
    }, { signal: req.signal });

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
