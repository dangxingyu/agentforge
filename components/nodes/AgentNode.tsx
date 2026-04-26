'use client';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { NodeData, ModelId } from '@/types/pipeline';
import { MODEL_LABELS, MODEL_PROVIDERS } from '@/types/pipeline';
import { Bot } from 'lucide-react';
import NodeRunBadge from './NodeRunBadge';
import { useRunStore } from '@/store/runStore';

const MODEL_PILL: Record<string, string> = {
  Anthropic: 'bg-[#fdebdd] text-[#c2410c] border-[#f1bd92]',
  OpenAI: 'bg-[#e7f6ee] text-[#15803d] border-[#a8d9bd]',
  Google: 'bg-[#eef3fb] text-[#1b61c9] border-[#bcd0ee]',
};

export default function AgentNode({ id, data, selected }: NodeProps<NodeData>) {
  const cfg = data.agentConfig;
  const provider = cfg ? MODEL_PROVIDERS[cfg.model as ModelId] ?? 'Anthropic' : 'Anthropic';
  const modelPill = MODEL_PILL[provider] ?? MODEL_PILL.Anthropic;
  const runState = useRunStore((s) => s.nodes[id]);
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
            className={`shrink-0 rounded-[6px] px-1.5 py-0.5 text-[10px] font-semibold tracking-caption border ${modelPill}`}
          >
            {MODEL_LABELS[cfg.model as ModelId]?.split(' ').slice(-1)[0] ?? cfg.model}
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
