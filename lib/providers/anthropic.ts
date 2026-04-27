import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, LLMRequest } from './types';

/**
 * Anthropic provider — uses the official SDK, with native streaming and
 * abort-signal forwarding so a client cancellation actually kills the call.
 *
 * Extended thinking: when the request carries a positive `thinkingBudget`
 * AND the chosen model declares `supportsThinking`, we add the SDK's
 * `thinking: { type: 'enabled', budget_tokens }` parameter and force
 * `temperature: 1` (Anthropic requires this with thinking enabled).
 *
 * We only forward visible text deltas to `onPartial` — thinking tokens
 * stay on the server (and are charged for, but the user sees the visible
 * answer streaming).
 */
export const anthropicProvider: LLMProvider = {
  id: 'anthropic',

  async call(req: LLMRequest, apiKey: string): Promise<string> {
    const client = new Anthropic({ apiKey });

    type StreamParams = Parameters<typeof client.messages.stream>[0];
    const params: StreamParams = {
      model: req.model.providerModel,
      max_tokens: req.maxTokens,
      temperature: req.temperature,
      system: req.system,
      messages: [{ role: 'user', content: req.user }],
    };

    if (req.thinkingBudget && req.thinkingBudget > 0 && req.model.supportsThinking) {
      // Anthropic's extended-thinking API requires temperature=1.
      params.thinking = {
        type: 'enabled',
        budget_tokens: Math.min(req.thinkingBudget, req.maxTokens - 1),
      };
      params.temperature = 1;
    }

    // Pass the abort signal through — the SDK aborts the underlying fetch.
    const stream = await client.messages.stream(params, {
      signal: req.signal,
    });

    let full = '';
    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        const chunk = event.delta.text;
        full += chunk;
        req.onPartial?.(chunk);
      }
    }
    return full;
  },
};
