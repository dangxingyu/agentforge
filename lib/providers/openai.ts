import OpenAI from 'openai';
import type { LLMProvider, LLMRequest } from './types';

/**
 * OpenAI provider — uses the official SDK, streaming chat completions.
 *
 * Reasoning models (o1, o3, o4-mini): the SDK auto-routes to /v1/responses
 * for these; we let it. We don't pass `temperature`/`max_tokens` for
 * reasoning models because the API rejects them — instead we forward
 * `max_completion_tokens` and the model's own reasoning effort default.
 */
export const openaiProvider: LLMProvider = {
  id: 'openai',

  async call(req: LLMRequest, apiKey: string): Promise<string> {
    const client = new OpenAI({ apiKey });

    const isReasoning = isReasoningModel(req.model.providerModel);

    if (isReasoning) {
      // Reasoning models: use the chat-completions API with the
      // reasoning-specific parameter set. The OpenAI SDK accepts
      // `max_completion_tokens` instead of `max_tokens`.
      const stream = await client.chat.completions.create(
        {
          model: req.model.providerModel,
          messages: [
            { role: 'system', content: req.system },
            { role: 'user', content: req.user },
          ],
          max_completion_tokens: req.maxTokens,
          stream: true,
        },
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
    }

    // Standard chat completions
    const stream = await client.chat.completions.create(
      {
        model: req.model.providerModel,
        messages: [
          { role: 'system', content: req.system },
          { role: 'user', content: req.user },
        ],
        temperature: req.temperature,
        max_tokens: req.maxTokens,
        stream: true,
      },
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

function isReasoningModel(model: string): boolean {
  // o1, o1-mini, o1-preview, o3, o3-mini, o4-mini, etc.
  return /^o\d/.test(model);
}
