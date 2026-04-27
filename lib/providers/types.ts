/**
 * Multi-provider LLM abstraction.
 *
 * AgentForge routes LLM calls through three providers:
 * - `anthropic`   — Anthropic Claude API directly (best abort & streaming)
 * - `openai`      — OpenAI API directly (GPT models, including reasoning ones)
 * - `openrouter`  — OpenRouter (one API key for Gemini / DeepSeek / Llama / Qwen / etc.)
 *
 * Each provider implements `LLMProvider.call()` with a uniform request shape.
 * The `ProviderRegistry` (lib/providers/index.ts) dispatches to the right one
 * based on the model's declared `provider` field, looking up the API key
 * supplied by the client (settings store) or, as a fallback, server env vars.
 *
 * Following the IMO25 / Momus convention: each model carries the
 * provider-specific name in `providerModel` (e.g. "anthropic/claude-sonnet-4-6"
 * for OpenRouter; "claude-sonnet-4-5-20250929" for Anthropic direct), so the
 * UI-facing `id` can be stable and provider-independent.
 */

export type ProviderId = 'anthropic' | 'openai' | 'openrouter';

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  /** Where users get an API key. */
  apiKeyDocsUrl: string;
  /** Format hint shown in the settings input. */
  apiKeyPlaceholder: string;
  /** Short description shown in settings. */
  description: string;
}

export type ModelTier = 'frontier' | 'mid' | 'fast' | 'open' | 'reasoning';

export interface ModelInfo {
  /** Stable internal identifier (used in NodeData.agentConfig.model). */
  id: string;
  /** Display name in the UI. */
  label: string;
  /** Which provider routes this model. */
  provider: ProviderId;
  /** Model name as the provider's API expects it. */
  providerModel: string;
  tier: ModelTier;
  /** Context window in tokens, for the UI to warn on long inputs. */
  contextWindow?: number;
  /** Whether the model supports reasoning / extended thinking. */
  supportsThinking?: boolean;
  /** Brief one-line description in the model picker. */
  description?: string;
  /** Marks user-added OpenRouter models so the UI can show a remove button. */
  custom?: boolean;
}

export interface ApiKeys {
  anthropic?: string;
  openai?: string;
  openrouter?: string;
}

export interface LLMRequest {
  system: string;
  user: string;
  model: ModelInfo;
  temperature: number;
  maxTokens: number;
  /** Reasoning-token budget (provider-specific):
   *   - anthropic: extended-thinking `budget_tokens`
   *   - openrouter: `reasoning.max_tokens`
   *   - openai: ignored (use o1/o3 for reasoning)
   */
  thinkingBudget?: number;
  signal?: AbortSignal;
  /** Called for each streamed text delta (no thinking tokens). */
  onPartial?: (chunk: string) => void;
}

export interface LLMProvider {
  id: ProviderId;
  call(req: LLMRequest, apiKey: string): Promise<string>;
}

export class MissingApiKeyError extends Error {
  constructor(public provider: ProviderId) {
    super(
      `Missing API key for ${provider}. Open Settings (top toolbar) and paste a key — or set the matching environment variable on the server.`
    );
    this.name = 'MissingApiKeyError';
  }
}

export class UnknownModelError extends Error {
  constructor(public modelId: string) {
    super(`Unknown model "${modelId}". The model may have been removed; pick a new one in the node detail panel.`);
    this.name = 'UnknownModelError';
  }
}
