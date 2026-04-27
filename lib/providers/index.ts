import { anthropicProvider } from './anthropic';
import { openaiProvider } from './openai';
import { openrouterProvider } from './openrouter';
import {
  type ApiKeys,
  type LLMProvider,
  type LLMRequest,
  type ProviderId,
  MissingApiKeyError,
  UnknownModelError,
} from './types';
import { resolveModel } from '../models';

const PROVIDERS: Record<ProviderId, LLMProvider> = {
  anthropic: anthropicProvider,
  openai: openaiProvider,
  openrouter: openrouterProvider,
};

/**
 * Routes a `(modelId, params)` call to the right provider using a set of
 * API keys. Created per-request so the keys don't escape the handler scope.
 *
 * Falls back to server-side env vars (ANTHROPIC_API_KEY / OPENAI_API_KEY /
 * OPENROUTER_API_KEY) when the client didn't supply a key for that provider.
 * This means the app works two ways:
 *   - User pastes their keys in Settings → runs use their quota.
 *   - Operator sets env vars → all users share that key (single-user deploy).
 */
export class ProviderRegistry {
  constructor(
    private apiKeys: ApiKeys,
    /** Custom OpenRouter slugs the user has added to their settings. */
    private customOpenRouterModels: string[] = []
  ) {}

  async call(modelId: string, params: Omit<LLMRequest, 'model'>): Promise<string> {
    const model = resolveModel(modelId, this.customOpenRouterModels);
    if (!model) throw new UnknownModelError(modelId);

    const apiKey = this.apiKeys[model.provider];
    if (!apiKey) throw new MissingApiKeyError(model.provider);

    const provider = PROVIDERS[model.provider];
    return provider.call({ ...params, model }, apiKey);
  }

  /** Which providers actually have a usable key configured? Used by the
   * UI to grey out / warn on models whose key is missing. */
  configuredProviders(): Set<ProviderId> {
    const set = new Set<ProviderId>();
    for (const id of Object.keys(this.apiKeys) as ProviderId[]) {
      if (this.apiKeys[id]) set.add(id);
    }
    return set;
  }
}

/** Build an ApiKeys object that prefers client-supplied keys, falling back
 * to server env vars. Server-side use only — `process.env` isn't available
 * (or shouldn't be) on the client. */
export function mergeApiKeys(client: ApiKeys = {}): ApiKeys {
  return {
    anthropic: client.anthropic ?? process.env.ANTHROPIC_API_KEY ?? undefined,
    openai: client.openai ?? process.env.OPENAI_API_KEY ?? undefined,
    openrouter: client.openrouter ?? process.env.OPENROUTER_API_KEY ?? undefined,
  };
}

export type { ApiKeys, ModelInfo, LLMProvider, ProviderId } from './types';
export { MissingApiKeyError, UnknownModelError } from './types';
