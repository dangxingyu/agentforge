import { describe, it, expect, vi } from 'vitest';
import { ProviderRegistry } from '../providers';
import { MissingApiKeyError, UnknownModelError } from '../providers/types';
import { lookupModel, MODELS, resolveModel } from '../models';

/**
 * Provider-routing tests. The audit caught a silent model-coercion bug
 * where every non-Anthropic id got rerouted to claude-sonnet-4-6. These
 * tests guard against that regression — calls go to the right provider
 * with the right `providerModel` string, missing keys throw clearly, and
 * custom OpenRouter slugs resolve.
 */

describe('lookupModel / resolveModel', () => {
  it('looks up curated models by id', () => {
    const m = lookupModel('claude-sonnet-4-6');
    expect(m?.provider).toBe('anthropic');
    expect(m?.providerModel).toMatch(/^claude-sonnet-/);
  });

  it('returns undefined for unknown ids', () => {
    expect(lookupModel('bogus-model-9000')).toBeUndefined();
  });

  it('every curated model has a non-empty providerModel', () => {
    for (const m of MODELS) {
      expect(m.providerModel.length, `${m.id} has empty providerModel`).toBeGreaterThan(0);
    }
  });

  it('resolves custom OpenRouter slugs prefixed with "or:"', () => {
    const m = resolveModel('or:x-ai/grok-2-vision', ['x-ai/grok-2-vision']);
    expect(m?.provider).toBe('openrouter');
    expect(m?.providerModel).toBe('x-ai/grok-2-vision');
    expect(m?.custom).toBe(true);
  });

  it('resolves a slug-shaped "or:" id even without explicit allowlist', () => {
    // Convenience: any well-shaped provider/model slug is accepted so
    // users don't have to "register" before the first run.
    const m = resolveModel('or:mistralai/mistral-large-2411', []);
    expect(m?.provider).toBe('openrouter');
  });
});

describe('ProviderRegistry routing', () => {
  it('throws MissingApiKeyError when the relevant provider is missing', () => {
    const reg = new ProviderRegistry({ openai: 'sk-test' });
    return expect(
      reg.call('claude-sonnet-4-6', {
        system: 's',
        user: 'u',
        temperature: 0.5,
        maxTokens: 100,
      })
    ).rejects.toBeInstanceOf(MissingApiKeyError);
  });

  it('throws UnknownModelError on unregistered ids', () => {
    const reg = new ProviderRegistry({
      anthropic: 'sk-ant',
      openai: 'sk-oai',
      openrouter: 'sk-or',
    });
    return expect(
      reg.call('made-up-model', {
        system: 's',
        user: 'u',
        temperature: 0.5,
        maxTokens: 100,
      })
    ).rejects.toBeInstanceOf(UnknownModelError);
  });

  it('configuredProviders reflects which keys are set', () => {
    const reg = new ProviderRegistry({ anthropic: 'k', openrouter: 'k' });
    const set = reg.configuredProviders();
    expect(set.has('anthropic')).toBe(true);
    expect(set.has('openrouter')).toBe(true);
    expect(set.has('openai')).toBe(false);
  });

  it('routes the right provider for each model id', async () => {
    // Patch the real provider modules with spy implementations so we
    // can assert routing without making real HTTP calls.
    const anthropicCall = vi.fn().mockResolvedValue('A');
    const openaiCall = vi.fn().mockResolvedValue('B');
    const openrouterCall = vi.fn().mockResolvedValue('C');

    // Cast through unknown to swap out the call implementations of the
    // singleton providers that the registry imports.
    const providers = await import('../providers/anthropic');
    const openai = await import('../providers/openai');
    const openrouter = await import('../providers/openrouter');
    (providers.anthropicProvider as unknown as { call: unknown }).call = anthropicCall;
    (openai.openaiProvider as unknown as { call: unknown }).call = openaiCall;
    (openrouter.openrouterProvider as unknown as { call: unknown }).call = openrouterCall;

    const reg = new ProviderRegistry({
      anthropic: 'sk-ant',
      openai: 'sk-oai',
      openrouter: 'sk-or',
    });

    await reg.call('claude-sonnet-4-6', {
      system: 's', user: 'u', temperature: 0.5, maxTokens: 100,
    });
    expect(anthropicCall).toHaveBeenCalledTimes(1);

    await reg.call('gpt-4o-mini', {
      system: 's', user: 'u', temperature: 0.5, maxTokens: 100,
    });
    expect(openaiCall).toHaveBeenCalledTimes(1);

    await reg.call('gemini-2.5-pro', {
      system: 's', user: 'u', temperature: 0.5, maxTokens: 100,
    });
    expect(openrouterCall).toHaveBeenCalledTimes(1);

    // Each provider's call received the right provider-specific model name.
    expect(anthropicCall.mock.calls[0][0].model.providerModel).toMatch(/^claude-sonnet-/);
    expect(openaiCall.mock.calls[0][0].model.providerModel).toBe('gpt-4o-mini');
    expect(openrouterCall.mock.calls[0][0].model.providerModel).toBe('google/gemini-2.5-pro');
  });
});
