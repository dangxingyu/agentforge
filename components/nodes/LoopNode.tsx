'use client';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { NodeData } from '@/types/pipeline';
import { RefreshCw } from 'lucide-react';

export default function LoopNode({ data, selected }: NodeProps<NodeData>) {
  const cfg = data.loopConfig;

  return (
    <div
      className={`w-60 rounded-[16px] bg-white overflow-hidden transition-all ${
        selected
          ? 'border border-[#7c3aed] shadow-[0_0_0_3px_rgba(124,58,237,0.18),0_1px_3px_rgba(124,58,237,0.20)]'
          : 'border border-[#e0e2e6] shadow-[0_1px_2px_rgba(15,48,106,0.04),0_4px_14px_rgba(15,48,106,0.06)] hover:border-[#cbd0d7]'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-[#7c3aed] !border-white !w-[9px] !h-[9px]"
      />

      <div className="flex items-center gap-2 px-3.5 py-2.5 bg-[#f0eafb] border-b border-[#c8b4ec]">
        <div className="w-6 h-6 rounded-[8px] bg-[#7c3aed] flex items-center justify-center shrink-0 shadow-[0_1px_2px_rgba(124,58,237,0.35)]">
          <RefreshCw size={13} className="text-white" strokeWidth={2.2} />
        </div>
        <span className="text-[13px] font-semibold text-[#181d26] tracking-ui truncate flex-1">
          {data.label}
        </span>
        {cfg && (
          <span className="shrink-0 rounded-[6px] bg-white border border-[#c8b4ec] px-1.5 py-0.5 text-[10px] font-semibold text-[#6d28d9] tracking-caption">
            max {cfg.maxIterations}×
          </span>
        )}
      </div>

      <div className="px-3.5 py-3 space-y-2">
        {data.description && (
          <p className="text-[12px] text-[rgba(4,14,32,0.69)] leading-relaxed tracking-ui">
            {data.description}
          </p>
        )}
        {cfg && (
          <div className="rounded-[10px] bg-[#f6f1fc] border border-[#c8b4ec] px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-caption text-[#6d28d9] font-semibold mb-1">
              Break when
            </p>
            <code className="text-[11px] text-[#5b21b6] font-mono leading-snug">
              {cfg.breakCondition}
            </code>
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-[#7c3aed] !border-white !w-[9px] !h-[9px]"
      />
    </div>
  );
}
