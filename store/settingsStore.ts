import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ApiKeys, ProviderId } from '@/lib/providers/types';

/**
 * User settings — API keys for each provider plus extras like custom
 * OpenRouter model slugs. Persisted to localStorage so a user only enters
 * keys once per browser.
 *
 * SECURITY NOTE: API keys live in localStorage in plaintext, and travel
 * in the request body to /api/run when a run is kicked off. This is
 * acceptable for a single-user designer running on the user's own machine
 * (the equivalent threat surface to a CLI tool that reads ~/.config/x).
 *
 * For a multi-tenant deployment swap this for: (a) keys stored
 * server-side per-account, OR (b) BYO key in a dedicated server-side
 * vault. Don't ship the localStorage approach for shared installations.
 */

interface SettingsState {
  apiKeys: ApiKeys;
  /** User-added OpenRouter model slugs (e.g. "x-ai/grok-2-vision"). */
  customOpenRouterModels: string[];
  _hasHydrated: boolean;

  setApiKey: (provider: ProviderId, key: string) => void;
  clearApiKey: (provider: ProviderId) => void;
  addCustomModel: (slug: string) => void;
  removeCustomModel: (slug: string) => void;
  _setHydrated: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      apiKeys: {},
      customOpenRouterModels: [],
      _hasHydrated: false,

      setApiKey: (provider, key) =>
        set((s) => ({
          apiKeys: { ...s.apiKeys, [provider]: key.trim() || undefined },
        })),

      clearApiKey: (provider) =>
        set((s) => {
          const next = { ...s.apiKeys };
          delete next[provider];
          return { apiKeys: next };
        }),

      addCustomModel: (slug) =>
        set((s) => {
          const trimmed = slug.trim();
          if (!trimmed || s.customOpenRouterModels.includes(trimmed)) return s;
          return {
            customOpenRouterModels: [...s.customOpenRouterModels, trimmed],
          };
        }),

      removeCustomModel: (slug) =>
        set((s) => ({
          customOpenRouterModels: s.customOpenRouterModels.filter((m) => m !== slug),
        })),

      _setHydrated: () => set({ _hasHydrated: true }),
    }),
    {
      name: 'agentforge-settings-v1',
      version: 1,
      storage: createJSONStorage(() => {
        // Defensive: if localStorage is unavailable (private mode, quota,
        // or SSR), return a noop storage so the app still loads.
        if (typeof window === 'undefined') return noopStorage;
        try {
          const probe = '__agentforge_probe__';
          window.localStorage.setItem(probe, probe);
          window.localStorage.removeItem(probe);
          return window.localStorage;
        } catch {
          return noopStorage;
        }
      }),
      partialize: (state) => ({
        apiKeys: state.apiKeys,
        customOpenRouterModels: state.customOpenRouterModels,
      }),
      onRehydrateStorage: () => (state) => {
        state?._setHydrated();
      },
    }
  )
);

const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};
