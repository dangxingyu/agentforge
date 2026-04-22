'use client';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { NodeData } from '@/types/pipeline';
import { Merge } from 'lucide-react';

const STRATEGY_LABEL: Record<string, string> = {
  all: 'Collect all',
  best: 'Keep best',
  vote: 'Majority vote',
  first: 'First done',
  concat: 'Concatenate',
};

export default function AggregatorNode({ data, selected }: NodeProps<NodeData>) {
  const cfg = data.aggregatorConfig;

  return (
    <div
      className={`w-60 rounded-[16px] bg-white overflow-hidden transition-all ${
        selected
          ? 'border border-[#0891b2] shadow-[0_0_0_3px_rgba(8,145,178,0.18),0_1px_3px_rgba(8,145,178,0.20)]'
          : 'border border-[#e0e2e6] shadow-[0_1px_2px_rgba(15,48,106,0.04),0_4px_14px_rgba(15,48,106,0.06)] hover:border-[#cbd0d7]'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-[#0891b2] !border-white !w-[9px] !h-[9px]"
      />

      <div className="flex items-center gap-2 px-3.5 py-2.5 bg-[#e3f4f7] border-b border-[#a3d1dc]">
        <div className="w-6 h-6 rounded-[8px] bg-[#0891b2] flex items-center justify-center shrink-0 shadow-[0_1px_2px_rgba(8,145,178,0.35)]">
          <Merge size={13} className="text-white" strokeWidth={2.2} />
        </div>
        <span className="text-[13px] font-semibold text-[#181d26] tracking-ui truncate">
          {data.label}
        </span>
      </div>

      <div className="px-3.5 py-3 space-y-2">
        {data.description && (
          <p className="text-[12px] text-[rgba(4,14,32,0.69)] leading-relaxed tracking-ui">
            {data.description}
          </p>
        )}
        {cfg && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-caption text-[rgba(4,14,32,0.55)] font-semibold">
              Strategy
            </span>
            <span className="rounded-[6px] bg-[#e3f4f7] border border-[#a3d1dc] px-2 py-0.5 text-[11px] text-[#0e7490] font-semibold tracking-ui">
              {STRATEGY_LABEL[cfg.strategy] ?? cfg.strategy}
            </span>
          </div>
        )}
        {cfg?.selectionCriteria && (
          <p className="text-[10px] text-[rgba(4,14,32,0.55)] font-mono leading-relaxed border-t border-[#e0e2e6] pt-2">
            {cfg.selectionCriteria}
          </p>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-[#0891b2] !border-white !w-[9px] !h-[9px]"
      />
    </div>
  );
}
