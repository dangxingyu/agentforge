'use client';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { NodeData } from '@/types/pipeline';
import { GitBranch } from 'lucide-react';

export default function DecisionNode({ data, selected }: NodeProps<NodeData>) {
  const cfg = data.decisionConfig;

  return (
    <div
      className={`w-60 rounded-[16px] bg-white overflow-hidden transition-all ${
        selected
          ? 'border border-[#d97706] shadow-[0_0_0_3px_rgba(217,119,6,0.18),0_1px_3px_rgba(45,127,249,0.20)]'
          : 'border border-[#e0e2e6] shadow-[0_1px_2px_rgba(15,48,106,0.04),0_4px_14px_rgba(15,48,106,0.06)] hover:border-[#cbd0d7]'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-[#d97706] !border-white !w-[9px] !h-[9px]"
      />

      <div className="flex items-center gap-2 px-3.5 py-2.5 bg-[#fef4e6] border-b border-[#f5d7a0]">
        <div className="w-6 h-6 rounded-[8px] bg-[#d97706] flex items-center justify-center shrink-0 shadow-[0_1px_2px_rgba(217,119,6,0.35)]">
          <GitBranch size={13} className="text-white" strokeWidth={2.2} />
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
          <div className="rounded-[10px] bg-[#fef9ef] border border-[#f5d7a0] px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-caption text-[#b45309] font-semibold mb-1">
              Condition
            </p>
            <code className="text-[11px] text-[#92400e] font-mono leading-snug">
              {cfg.condition}
            </code>
          </div>
        )}
        {cfg && (
          <div className="flex gap-3 mt-1">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#15803d]" />
              <span className="text-[10px] tracking-caption font-semibold text-[#15803d]">
                {cfg.trueLabel}
              </span>
            </div>
            <div className="flex items-center gap-1.5 ml-auto">
              <div className="w-1.5 h-1.5 rounded-full bg-[#be123c]" />
              <span className="text-[10px] tracking-caption font-semibold text-[#be123c]">
                {cfg.falseLabel}
              </span>
            </div>
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="true"
        style={{ top: '62%' }}
        className="!bg-[#15803d] !border-white !w-[9px] !h-[9px]"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        className="!bg-[#be123c] !border-white !w-[9px] !h-[9px]"
      />
    </div>
  );
}
