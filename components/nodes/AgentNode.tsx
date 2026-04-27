'use client';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { NodeData } from '@/types/pipeline';
import { Bot } from 'lucide-react';
import NodeRunBadge from './NodeRunBadge';
import { useRunStore } from '@/store/runStore';
import { useSettingsStore } from '@/store/settingsStore';
import { resolveModel } from '@/lib/models';
import type { ProviderId } from '@/lib/providers/types';

/**
 * Per-provider visual treatment for the model pill in the node header.
 * Uses the same accent palette as the rest of the system so the canvas
 * tells you "what's running on what" at a glance.
 */
const PROVIDER_PILL: Record<ProviderId, string> = {
  anthropic: 'bg-[#fdebdd] text-[#c2410c] border-[#f1bd92]',
  openai: 'bg-[#e7f6ee] text-[#15803d] border-[#a8d9bd]',
  openrouter: 'bg-[#eef3fb] text-[#1b61c9] border-[#bcd0ee]',
};

const PROVIDER_PILL_FALLBACK = 'bg-[#f1f4f8] text-[rgba(4,14,32,0.69)] border-[#cbd0d7]';

/** Pull a short, readable label out of a model's display name — "Claude
 * Sonnet 4.6" → "Sonnet 4.6". Avoids the "thinking)" tail-bug from the
 * old `split(' ').slice(-1)` approach. */
function shortModelLabel(label: string): string {
  // Strip parenthesized clarifiers (e.g. "(via OpenRouter)").
  const stripped = label.replace(/\s*\([^)]*\)\s*$/, '').trim();
  // For "Claude Sonnet 4.6" / "GPT-4o Mini" / "Gemini 2.5 Pro" — take
  // everything after the family prefix when one's present.
  const parts = stripped.split(' ');
  if (parts.length >= 2 && /^(Claude|Gemini|GPT-|GPT|DeepSeek|Llama|Grok|Qwen|OpenAI)/.test(parts[0])) {
    return parts.slice(1).join(' ');
  }
  return stripped;
}

export default function AgentNode({ id, data, selected }: NodeProps<NodeData>) {
  const cfg = data.agentConfig;
  const customOpenRouterModels = useSettingsStore((s) => s.customOpenRouterModels);
  const runState = useRunStore((s) => s.nodes[id]);

  const modelInfo = cfg ? resolveModel(cfg.model, customOpenRouterModels) : undefined;
  const modelPill = modelInfo
    ? PROVIDER_PILL[modelInfo.provider]
    : PROVIDER_PILL_FALLBACK;
  // If the id resolves, show the short label; otherwise show the raw id
  // so the user can see what's set and fix it.
  const modelDisplay = modelInfo ? shortModelLabel(modelInfo.label) : cfg?.model ?? '';

  const truncated = cfg?.systemPrompt
    ? cfg.systemPrompt.length > 110
      ? cfg.systemPrompt.slice(0, 107) + '…'
      : cfg.systemPrompt
    : '';

  // While streaming, replace the prompt preview with the live partial output.
  const livePartial =
    runState?.status === 'running' && runState.partial
      ? runState.partial.slice(-160)
      : null;

  return (
    <div className="relative">
      <NodeRunBadge nodeId={id} />
      <div
        className={`w-64 rounded-[16px] bg-white overflow-hidden transition-all ${
          selected
            ? 'border border-[#1b61c9] shadow-[0_0_0_3px_rgba(27,97,201,0.18),0_0_1px_rgba(0,0,0,0.32),0_1px_3px_rgba(45,127,249,0.28)]'
            : 'border border-[#e0e2e6] shadow-[0_1px_2px_rgba(15,48,106,0.04),0_4px_14px_rgba(15,48,106,0.06)] hover:border-[#cbd0d7]'
        } ${runState?.status === 'running' ? 'ring-2 ring-[#1b61c9] ring-offset-2 ring-offset-[#f8fafc]' : ''}`}
      >
        <Handle
          type="target"
          position={Position.Top}
          className="!bg-[#1b61c9] !border-white !w-[9px] !h-[9px]"
        />

        {/* Header */}
        <div className="flex items-center gap-2 px-3.5 py-2.5 bg-[#eef3fb] border-b border-[#dbe7f7]">
          <div className="w-6 h-6 rounded-[8px] bg-[#1b61c9] flex items-center justify-center shrink-0 shadow-[0_1px_2px_rgba(45,127,249,0.28)]">
            <Bot size={13} className="text-white" strokeWidth={2.2} />
          </div>
          <span className="text-[13px] font-semibold text-[#181d26] tracking-ui truncate flex-1">
            {data.label}
          </span>
          {cfg && (
            <span
              title={modelInfo ? `${modelInfo.label} · ${modelInfo.provider}` : `Unknown model id "${cfg.model}"`}
              className={`shrink-0 rounded-[6px] px-1.5 py-0.5 text-[10px] font-semibold tracking-caption border max-w-[120px] truncate ${modelPill}`}
            >
              {modelDisplay}
            </span>
          )}
        </div>

        {/* Body */}
        <div className="px-3.5 py-3 space-y-2">
          {cfg?.role && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-caption text-[rgba(4,14,32,0.55)] font-semibold">
                Role
              </span>
              <span className="text-[11px] text-[#1b61c9] font-mono bg-[#eef3fb] rounded-[6px] px-1.5 py-0.5 border border-[#dbe7f7]">
                {cfg.role}
              </span>
            </div>
          )}
          {data.description && (
            <p className="text-[12px] text-[rgba(4,14,32,0.69)] leading-relaxed tracking-ui">
              {data.description}
            </p>
          )}
          {livePartial ? (
            <p className="text-[11px] text-[#1b61c9] leading-relaxed font-mono border-t border-[#e0e2e6] pt-2 line-clamp-3 whitespace-pre-wrap">
              {livePartial}
              <span className="inline-block w-1 h-[10px] bg-[#1b61c9] ml-0.5 align-middle animate-pulse" />
            </p>
          ) : (
            truncated && (
              <p className="text-[11px] text-[rgba(4,14,32,0.55)] leading-relaxed font-mono border-t border-[#e0e2e6] pt-2 line-clamp-3">
                {truncated}
              </p>
            )
          )}
          {cfg && (
            <div className="flex items-center gap-3 text-[10px] text-[rgba(4,14,32,0.55)] tracking-caption font-medium border-t border-[#e0e2e6] pt-2">
              <span className="flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-[#94a3b8]" />
                T={cfg.temperature}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-[#94a3b8]" />
                {(cfg.maxTokens / 1000).toFixed(0)}k tokens
              </span>
              {cfg.thinkingBudget && cfg.thinkingBudget > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-[#94a3b8]" />
                  +{(cfg.thinkingBudget / 1000).toFixed(0)}k thinking
                </span>
              )}
            </div>
          )}
        </div>

        <Handle
          type="source"
          position={Position.Bottom}
          className="!bg-[#1b61c9] !border-white !w-[9px] !h-[9px]"
        />
      </div>
    </div>
  );
}
