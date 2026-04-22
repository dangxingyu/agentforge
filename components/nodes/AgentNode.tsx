'use client';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { NodeData, ModelId } from '@/types/pipeline';
import { MODEL_LABELS } from '@/types/pipeline';
import { Bot } from 'lucide-react';

const MODEL_COLORS: Record<string, string> = {
  Anthropic: 'bg-orange-900/60 text-orange-300 border-orange-700',
  OpenAI: 'bg-emerald-900/60 text-emerald-300 border-emerald-700',
  Google: 'bg-blue-900/60 text-blue-300 border-blue-700',
};

import { MODEL_PROVIDERS } from '@/types/pipeline';

export default function AgentNode({ data, selected }: NodeProps<NodeData>) {
  const cfg = data.agentConfig;
  const provider = cfg ? MODEL_PROVIDERS[cfg.model as ModelId] ?? 'Anthropic' : 'Anthropic';
  const modelColor = MODEL_COLORS[provider] ?? MODEL_COLORS.Anthropic;
  const truncated = cfg?.systemPrompt
    ? cfg.systemPrompt.length > 100
      ? cfg.systemPrompt.slice(0, 97) + '…'
      : cfg.systemPrompt
    : '';

  return (
    <div
      className={`w-60 rounded-xl border bg-slate-900 shadow-xl transition-all ${
        selected ? 'border-indigo-400 shadow-indigo-500/20 shadow-2xl' : 'border-slate-700'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-slate-500 !border-slate-400 !w-2.5 !h-2.5" />

      <div className="flex items-center gap-2 rounded-t-xl bg-indigo-950/80 px-3 py-2 border-b border-indigo-900">
        <Bot size={14} className="text-indigo-400 shrink-0" />
        <span className="text-xs font-semibold text-indigo-200 truncate">{data.label}</span>
        {cfg && (
          <span className={`ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium border ${modelColor}`}>
            {MODEL_LABELS[cfg.model as ModelId]?.split(' ').slice(-1)[0] ?? cfg.model}
          </span>
        )}
      </div>

      <div className="px-3 py-2.5 space-y-1.5">
        {cfg?.role && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Role</span>
            <span className="text-[11px] text-slate-300 font-mono bg-slate-800 rounded px-1.5 py-0.5">{cfg.role}</span>
          </div>
        )}
        {data.description && (
          <p className="text-[11px] text-slate-400 leading-relaxed">{data.description}</p>
        )}
        {truncated && (
          <p className="text-[10px] text-slate-500 leading-relaxed font-mono border-t border-slate-800 pt-1.5 line-clamp-3">
            {truncated}
          </p>
        )}
        {cfg && (
          <div className="flex gap-2 text-[10px] text-slate-500 border-t border-slate-800 pt-1.5">
            <span>T={cfg.temperature}</span>
            <span>·</span>
            <span>{(cfg.maxTokens / 1000).toFixed(0)}k tokens</span>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-slate-500 !border-slate-400 !w-2.5 !h-2.5" />
    </div>
  );
}
