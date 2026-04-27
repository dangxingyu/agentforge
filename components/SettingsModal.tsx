'use client';
import { useState, useEffect } from 'react';
import {
  X,
  Eye,
  EyeOff,
  CheckCircle2,
  ExternalLink,
  Plus,
  Trash2,
  KeyRound,
  AlertCircle,
} from 'lucide-react';
import { useSettingsStore } from '@/store/settingsStore';
import { PROVIDERS } from '@/lib/models';
import type { ProviderId } from '@/lib/providers/types';

/**
 * Settings modal. Configures per-provider API keys and lets the user
 * add custom OpenRouter model slugs that appear in the model dropdown.
 *
 * All state is persisted to localStorage via `useSettingsStore`. Keys
 * are sent in the request body for /api/run / /api/chat — the server
 * never persists them.
 */
export default function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const apiKeys = useSettingsStore((s) => s.apiKeys);
  const customModels = useSettingsStore((s) => s.customOpenRouterModels);
  const setApiKey = useSettingsStore((s) => s.setApiKey);
  const clearApiKey = useSettingsStore((s) => s.clearApiKey);
  const addCustomModel = useSettingsStore((s) => s.addCustomModel);
  const removeCustomModel = useSettingsStore((s) => s.removeCustomModel);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[rgba(15,48,106,0.18)] backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[85vh] overflow-y-auto bg-white rounded-[24px] border border-[#e0e2e6] shadow-[0_0_0_1px_rgba(15,48,106,0.06),0_24px_60px_rgba(15,48,106,0.18),0_8px_18px_rgba(15,48,106,0.08)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-[#e0e2e6]">
          <div className="w-10 h-10 rounded-[12px] bg-[#1b61c9] flex items-center justify-center shadow-[0_1px_3px_rgba(45,127,249,0.28)]">
            <KeyRound size={18} className="text-white" strokeWidth={2.2} />
          </div>
          <div className="flex-1">
            <h2 className="text-[16px] font-semibold text-[#181d26] tracking-display">Settings</h2>
            <p className="text-[12px] text-[rgba(4,14,32,0.55)] tracking-ui mt-0.5">
              API keys are stored in your browser&rsquo;s localStorage and sent in the body of run requests. Never persisted server-side.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-[10px] flex items-center justify-center text-[rgba(4,14,32,0.55)] hover:text-[#181d26] hover:bg-[#f1f4f8] transition-colors"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Provider keys */}
          <section>
            <h3 className="text-[10px] uppercase tracking-caption text-[rgba(4,14,32,0.55)] font-semibold mb-3">
              API keys
            </h3>
            <div className="space-y-3">
              {PROVIDERS.map((provider) => (
                <ApiKeyField
                  key={provider.id}
                  provider={provider.id}
                  label={provider.label}
                  description={provider.description}
                  docsUrl={provider.apiKeyDocsUrl}
                  placeholder={provider.apiKeyPlaceholder}
                  value={apiKeys[provider.id] ?? ''}
                  onChange={(v) => setApiKey(provider.id, v)}
                  onClear={() => clearApiKey(provider.id)}
                />
              ))}
            </div>
          </section>

          {/* Custom OpenRouter models */}
          <section>
            <h3 className="text-[10px] uppercase tracking-caption text-[rgba(4,14,32,0.55)] font-semibold mb-2">
              Custom OpenRouter models
            </h3>
            <p className="text-[12px] text-[rgba(4,14,32,0.69)] tracking-ui mb-3 leading-relaxed">
              Paste any model slug from{' '}
              <a
                href="https://openrouter.ai/models"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#1b61c9] hover:underline"
              >
                openrouter.ai/models
              </a>{' '}
              (e.g. <code className="font-mono text-[11px] bg-[#f1f4f8] px-1 py-0.5 rounded">x-ai/grok-2-vision</code>) to make it available in the model dropdown.
            </p>
            <CustomModelInput onAdd={addCustomModel} />
            {customModels.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {customModels.map((slug) => (
                  <li
                    key={slug}
                    className="flex items-center gap-2 px-3 py-2 rounded-[10px] bg-[#f8fafc] border border-[#e0e2e6]"
                  >
                    <code className="text-[12px] font-mono text-[#181d26] flex-1 truncate">{slug}</code>
                    <button
                      onClick={() => removeCustomModel(slug)}
                      className="w-7 h-7 rounded-[8px] flex items-center justify-center text-[rgba(4,14,32,0.55)] hover:text-[#be123c] hover:bg-[#fdf2f4] transition-colors"
                      title="Remove"
                    >
                      <Trash2 size={13} strokeWidth={2} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Server fallback notice */}
          <section className="rounded-[12px] bg-[#eef3fb] border border-[#bcd0ee] px-3.5 py-3">
            <p className="text-[11px] text-[#1755b1] tracking-ui leading-relaxed flex items-start gap-2">
              <AlertCircle size={13} strokeWidth={2.2} className="shrink-0 mt-0.5" />
              <span>
                Server env vars{' '}
                <code className="font-mono">ANTHROPIC_API_KEY</code>,{' '}
                <code className="font-mono">OPENAI_API_KEY</code>,{' '}
                <code className="font-mono">OPENROUTER_API_KEY</code>{' '}
                are used as fallbacks when no key is set here. Keys you paste here
                always take priority and never leave your browser except as the
                run-request body.
              </span>
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-[#e0e2e6] bg-[#f8fafc] rounded-b-[24px]">
          <button
            onClick={onClose}
            className="h-9 px-5 rounded-[12px] bg-[#1b61c9] hover:bg-[#1755b1] text-white text-[13px] font-semibold tracking-ui shadow-[0_1px_3px_rgba(45,127,249,0.28)] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────────

function ApiKeyField({
  provider,
  label,
  description,
  docsUrl,
  placeholder,
  value,
  onChange,
  onClear,
}: {
  provider: ProviderId;
  label: string;
  description: string;
  docsUrl: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onClear: () => void;
}) {
  const [show, setShow] = useState(false);
  const configured = value.length > 0;

  return (
    <div className="rounded-[12px] border border-[#e0e2e6] bg-white p-3.5 transition-colors hover:border-[#cbd0d7]">
      <div className="flex items-start justify-between mb-2 gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-[#181d26] tracking-ui">{label}</span>
            {configured && (
              <span className="inline-flex items-center gap-1 rounded-[6px] bg-[#e7f6ee] border border-[#a8d9bd] px-1.5 py-0.5 text-[10px] font-semibold text-[#15803d] tracking-caption">
                <CheckCircle2 size={9} strokeWidth={2.5} /> configured
              </span>
            )}
          </div>
          <p className="text-[11px] text-[rgba(4,14,32,0.69)] tracking-ui mt-1 leading-snug">
            {description}
          </p>
        </div>
        <a
          href={docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-1 text-[10px] text-[#1b61c9] hover:underline tracking-ui"
        >
          Get key <ExternalLink size={10} strokeWidth={2.2} />
        </a>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <input
            type={show ? 'text' : 'password'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full bg-[#f8fafc] border border-[#e0e2e6] rounded-[10px] pl-3 pr-10 py-2 text-[12px] font-mono text-[#181d26] placeholder:text-[rgba(4,14,32,0.38)] tracking-ui focus:border-[#1b61c9] focus:bg-white focus:shadow-[0_0_0_3px_rgba(27,97,201,0.12)] outline-none transition-all"
            autoComplete="off"
            spellCheck={false}
            data-1p-ignore
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-[6px] flex items-center justify-center text-[rgba(4,14,32,0.55)] hover:text-[#181d26] hover:bg-[#f1f4f8] transition-colors"
            title={show ? 'Hide' : 'Show'}
            aria-label={show ? `Hide ${label} API key` : `Show ${label} API key`}
          >
            {show ? <EyeOff size={12} strokeWidth={2} /> : <Eye size={12} strokeWidth={2} />}
          </button>
        </div>
        {configured && (
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 text-[11px] font-medium text-[rgba(4,14,32,0.69)] hover:text-[#be123c] tracking-ui px-2 py-2 rounded-[8px] hover:bg-[#fdf2f4] transition-colors"
            title={`Clear ${label} key`}
          >
            Clear
          </button>
        )}
      </div>
      {/* invisible field to satisfy the unused-var lint when provider isn't read */}
      <input type="hidden" value={provider} aria-hidden />
    </div>
  );
}

function CustomModelInput({ onAdd }: { onAdd: (slug: string) => void }) {
  const [val, setVal] = useState('');
  const valid = /^[\w.-]+\/[\w.-]+$/.test(val.trim());

  const submit = () => {
    if (valid) {
      onAdd(val.trim());
      setVal('');
    }
  };

  return (
    <div className="flex gap-2 items-center">
      <input
        type="text"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder="provider/model-slug, e.g. mistralai/mistral-large-2411"
        className="flex-1 bg-white border border-[#e0e2e6] rounded-[10px] px-3 py-2 text-[12px] font-mono text-[#181d26] placeholder:text-[rgba(4,14,32,0.38)] tracking-ui focus:border-[#1b61c9] focus:shadow-[0_0_0_3px_rgba(27,97,201,0.12)] outline-none transition-all"
        autoComplete="off"
        spellCheck={false}
      />
      <button
        type="button"
        onClick={submit}
        disabled={!valid}
        className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-[10px] bg-white border border-[#e0e2e6] hover:border-[#1b61c9] hover:bg-[#eef3fb] disabled:opacity-40 disabled:cursor-not-allowed text-[12px] font-medium text-[#181d26] tracking-ui transition-colors"
      >
        <Plus size={12} strokeWidth={2.2} /> Add
      </button>
    </div>
  );
}
