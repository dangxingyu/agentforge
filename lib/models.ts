import type { ModelInfo, ProviderInfo } from './providers/types';

/**
 * Curated model registry.
 *
 * Adding a new model: append to MODELS. The pipeline UI's model dropdown
 * groups by `provider` automatically. For OpenRouter models a user can
 * also paste a custom slug at runtime via Settings — those go into
 * `customOpenRouterModels` in the settings store and are unioned with
 * this list at lookup time.
 *
 * Model IDs here are stable AgentForge identifiers — they should NOT
 * change when an underlying provider renames a model. The `providerModel`
 * field maps to whatever the API actually expects today.
 *
 * For the IMO25 / Momus templates we deliberately surface both the direct
 * Anthropic models and their OpenRouter equivalents — the upstream Python
 * codebase routes most models through OpenRouter, so users porting configs
 * can pick the same id.
 */

export const PROVIDERS: ProviderInfo[] = [
  {
    id: 'anthropic',
    label: 'Anthropic',
    apiKeyDocsUrl: 'https://console.anthropic.com/settings/keys',
    apiKeyPlaceholder: 'sk-ant-api03-…',
    description: 'Direct Anthropic API. Best streaming + abort, native extended thinking.',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    apiKeyDocsUrl: 'https://platform.openai.com/api-keys',
    apiKeyPlaceholder: 'sk-…',
    description: 'Direct OpenAI API. Includes GPT-4 / GPT-5 family and reasoning models (o1, o3, o4).',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    apiKeyDocsUrl: 'https://openrouter.ai/keys',
    apiKeyPlaceholder: 'sk-or-v1-…',
    description: 'One key, ~150 models — Gemini, DeepSeek, Llama, Qwen, Grok, plus Claude/GPT mirrors. Same router IMO25 uses.',
  },
];

export const MODELS: ModelInfo[] = [
  // ─── Anthropic direct ──────────────────────────────────────────────────
  {
    id: 'claude-opus-4-7',
    label: 'Claude Opus 4.7',
    provider: 'anthropic',
    providerModel: 'claude-opus-4-5-20251101',
    tier: 'frontier',
    contextWindow: 200_000,
    supportsThinking: true,
    description: 'Anthropic flagship. Maximum quality, slowest, most expensive.',
  },
  {
    id: 'claude-sonnet-4-6',
    label: 'Claude Sonnet 4.6',
    provider: 'anthropic',
    providerModel: 'claude-sonnet-4-5-20250929',
    tier: 'mid',
    contextWindow: 200_000,
    supportsThinking: true,
    description: 'Anthropic balanced. Most pipelines should default to this.',
  },
  {
    id: 'claude-haiku-4-5',
    label: 'Claude Haiku 4.5',
    provider: 'anthropic',
    providerModel: 'claude-haiku-4-5-20251001',
    tier: 'fast',
    contextWindow: 200_000,
    supportsThinking: true,
    description: 'Anthropic fast/cheap. Good for parsers, formatters, light grading.',
  },

  // ─── OpenAI direct ─────────────────────────────────────────────────────
  {
    id: 'gpt-5',
    label: 'GPT-5',
    provider: 'openai',
    providerModel: 'gpt-5',
    tier: 'frontier',
    contextWindow: 400_000,
    description: 'OpenAI flagship.',
  },
  {
    id: 'gpt-5-mini',
    label: 'GPT-5 Mini',
    provider: 'openai',
    providerModel: 'gpt-5-mini',
    tier: 'mid',
    contextWindow: 400_000,
    description: 'OpenAI mid-tier.',
  },
  {
    id: 'gpt-4o',
    label: 'GPT-4o',
    provider: 'openai',
    providerModel: 'gpt-4o',
    tier: 'mid',
    contextWindow: 128_000,
    description: 'GPT-4 Omni — multimodal, mid-tier.',
  },
  {
    id: 'gpt-4o-mini',
    label: 'GPT-4o Mini',
    provider: 'openai',
    providerModel: 'gpt-4o-mini',
    tier: 'fast',
    contextWindow: 128_000,
    description: 'OpenAI fast/cheap workhorse.',
  },
  {
    id: 'o3',
    label: 'OpenAI o3',
    provider: 'openai',
    providerModel: 'o3',
    tier: 'reasoning',
    contextWindow: 200_000,
    supportsThinking: true,
    description: 'OpenAI reasoning model (chain-of-thought baked in).',
  },
  {
    id: 'o4-mini',
    label: 'OpenAI o4-mini',
    provider: 'openai',
    providerModel: 'o4-mini',
    tier: 'reasoning',
    contextWindow: 200_000,
    supportsThinking: true,
    description: 'OpenAI lightweight reasoning model.',
  },

  // ─── OpenRouter (Google) ───────────────────────────────────────────────
  {
    id: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    provider: 'openrouter',
    providerModel: 'google/gemini-2.5-pro',
    tier: 'frontier',
    contextWindow: 1_000_000,
    supportsThinking: true,
    description: 'Google flagship. Default model in IMO25 / Momus for solver / grader.',
  },
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    provider: 'openrouter',
    providerModel: 'google/gemini-2.5-flash',
    tier: 'fast',
    contextWindow: 1_000_000,
    supportsThinking: true,
    description: 'Google fast/cheap. Default for parsers and quality checks in Momus.',
  },
  {
    id: 'gemini-3-pro',
    label: 'Gemini 3 Pro (preview)',
    provider: 'openrouter',
    providerModel: 'google/gemini-3-pro-preview',
    tier: 'frontier',
    contextWindow: 1_000_000,
    supportsThinking: true,
    description: 'Latest Gemini, preview. IMO25 uses this for Phase-1 solving.',
  },

  // ─── OpenRouter (DeepSeek) ─────────────────────────────────────────────
  {
    id: 'deepseek-r1',
    label: 'DeepSeek R1',
    provider: 'openrouter',
    providerModel: 'deepseek/deepseek-r1',
    tier: 'reasoning',
    contextWindow: 64_000,
    supportsThinking: true,
    description: 'Open-weights reasoning model from DeepSeek.',
  },
  {
    id: 'deepseek-v3',
    label: 'DeepSeek V3',
    provider: 'openrouter',
    providerModel: 'deepseek/deepseek-chat-v3.1',
    tier: 'open',
    contextWindow: 64_000,
    description: 'DeepSeek V3, fast & open.',
  },

  // ─── OpenRouter (Meta) ─────────────────────────────────────────────────
  {
    id: 'llama-3.3-70b',
    label: 'Llama 3.3 70B',
    provider: 'openrouter',
    providerModel: 'meta-llama/llama-3.3-70b-instruct',
    tier: 'open',
    contextWindow: 128_000,
    description: 'Meta open-weights, mid-tier.',
  },

  // ─── OpenRouter (xAI) ──────────────────────────────────────────────────
  {
    id: 'grok-4',
    label: 'Grok 4',
    provider: 'openrouter',
    providerModel: 'x-ai/grok-4',
    tier: 'frontier',
    contextWindow: 256_000,
    supportsThinking: true,
    description: 'xAI flagship.',
  },

  // ─── OpenRouter (Qwen) ─────────────────────────────────────────────────
  {
    id: 'qwen3-235b-thinking',
    label: 'Qwen 3 235B Thinking',
    provider: 'openrouter',
    providerModel: 'qwen/qwen3-235b-a22b-thinking-2507',
    tier: 'reasoning',
    contextWindow: 128_000,
    supportsThinking: true,
    description: 'Alibaba MoE reasoning model. IMO25 uses this.',
  },

  // ─── OpenRouter mirrors of Anthropic/OpenAI ────────────────────────────
  // Useful when a user only has an OpenRouter key.
  {
    id: 'or-claude-sonnet-4-6',
    label: 'Claude Sonnet 4.6 (via OpenRouter)',
    provider: 'openrouter',
    providerModel: 'anthropic/claude-sonnet-4.5',
    tier: 'mid',
    contextWindow: 200_000,
    supportsThinking: true,
    description: 'Same Sonnet, billed through OpenRouter.',
  },
  {
    id: 'or-gpt-5',
    label: 'GPT-5 (via OpenRouter)',
    provider: 'openrouter',
    providerModel: 'openai/gpt-5',
    tier: 'frontier',
    contextWindow: 400_000,
    description: 'Same GPT-5, billed through OpenRouter.',
  },
];

/** Map by id for O(1) lookup. */
export const MODELS_BY_ID: Map<string, ModelInfo> = new Map(
  MODELS.map((m) => [m.id, m])
);

/** Resolve a model id to its full info. Returns undefined if the id isn't
 * one of the curated models. Custom OpenRouter models added by the user
 * are NOT included here — call `resolveModel(id, customModels)` instead. */
export function lookupModel(id: string): ModelInfo | undefined {
  return MODELS_BY_ID.get(id);
}

/** Resolve a model id, falling back to a list of user-supplied custom
 * OpenRouter slugs. A custom slug like "x-ai/grok-2-vision" becomes a
 * synthetic ModelInfo on demand. */
export function resolveModel(id: string, customOpenRouterModels: string[] = []): ModelInfo | undefined {
  const direct = MODELS_BY_ID.get(id);
  if (direct) return direct;

  // Custom OpenRouter model? id is the slug itself, prefixed with "or:".
  if (id.startsWith('or:')) {
    const slug = id.slice(3);
    if (customOpenRouterModels.includes(slug) || /^[\w.-]+\/[\w.-]+/.test(slug)) {
      return {
        id,
        label: `OpenRouter: ${slug}`,
        provider: 'openrouter',
        providerModel: slug,
        tier: 'open',
        custom: true,
        description: 'User-added OpenRouter slug.',
      };
    }
  }
  return undefined;
}

/** Group models by provider for display in the picker. */
export function groupModelsByProvider(
  customOpenRouterModels: string[] = []
): { provider: ProviderInfo; models: ModelInfo[] }[] {
  const groups = PROVIDERS.map((p) => ({
    provider: p,
    models: MODELS.filter((m) => m.provider === p.id),
  }));
  if (customOpenRouterModels.length > 0) {
    const orGroup = groups.find((g) => g.provider.id === 'openrouter');
    if (orGroup) {
      for (const slug of customOpenRouterModels) {
        orGroup.models.push({
          id: `or:${slug}`,
          label: `Custom: ${slug}`,
          provider: 'openrouter',
          providerModel: slug,
          tier: 'open',
          custom: true,
        });
      }
    }
  }
  return groups;
}
