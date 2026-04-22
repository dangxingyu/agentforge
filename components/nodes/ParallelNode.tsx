'use client';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { NodeData } from '@/types/pipeline';
import { Zap } from 'lucide-react';

export default function ParallelNode({ data, selected }: NodeProps<NodeData>) {
  const cfg = data.parallelConfig;

  return (
    <div
      className={`w-60 rounded-[16px] bg-white overflow-hidden transition-all ${
        selected
          ? 'border border-[#16a34a] shadow-[0_0_0_3px_rgba(22,163,74,0.18),0_1px_3px_rgba(22,163,74,0.20)]'
          : 'border border-[#e0e2e6] shadow-[0_1px_2px_rgba(15,48,106,0.04),0_4px_14px_rgba(15,48,106,0.06)] hover:border-[#cbd0d7]'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-[#16a34a] !border-white !w-[9px] !h-[9px]"
      />

      <div className="flex items-center gap-2 px-3.5 py-2.5 bg-[#e7f6ee] border-b border-[#a8d9bd]">
        <div className="w-6 h-6 rounded-[8px] bg-[#16a34a] flex items-center justify-center shrink-0 shadow-[0_1px_2px_rgba(22,163,74,0.35)]">
          <Zap size={13} className="text-white" strokeWidth={2.2} />
        </div>
        <span className="text-[13px] font-semibold text-[#181d26] tracking-ui truncate flex-1">
          {data.label}
        </span>
        {cfg && (
          <span className="shrink-0 rounded-full bg-[#16a34a] px-2 py-0.5 text-[10px] font-bold text-white tracking-caption">
            ×{cfg.numParallel}
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
          <div className="flex items-center gap-2.5">
            <div className="flex gap-1">
              {Array.from({ length: Math.min(cfg.numParallel, 6) }).map((_, i) => (
                <div
                  key={i}
                  className="w-2.5 h-5 rounded-[3px] bg-[#a8d9bd] border border-[#6bb589]"
                />
              ))}
              {cfg.numParallel > 6 && (
                <span className="text-[10px] text-[#15803d] font-semibold self-center ml-0.5">
                  +{cfg.numParallel - 6}
                </span>
              )}
            </div>
            <span className="text-[11px] text-[rgba(4,14,32,0.55)] tracking-ui">
              {cfg.label ?? 'parallel instances'}
            </span>
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-[#16a34a] !border-white !w-[9px] !h-[9px]"
      />
    </div>
  );
}
