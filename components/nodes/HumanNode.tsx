'use client';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { NodeData } from '@/types/pipeline';
import { UserCheck } from 'lucide-react';
import NodeRunBadge from './NodeRunBadge';

export default function HumanNode({ id, data, selected }: NodeProps<NodeData>) {
  const cfg = data.humanConfig;

  return (
    <div className="relative">
      <NodeRunBadge nodeId={id} />
      <div
        className={`w-60 rounded-[16px] bg-white overflow-hidden transition-all ${
          selected
            ? 'border border-[#e11d48] shadow-[0_0_0_3px_rgba(225,29,72,0.18),0_1px_3px_rgba(225,29,72,0.20)]'
            : 'border border-[#e0e2e6] shadow-[0_1px_2px_rgba(15,48,106,0.04),0_4px_14px_rgba(15,48,106,0.06)] hover:border-[#cbd0d7]'
        }`}
      >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-[#e11d48] !border-white !w-[9px] !h-[9px]"
      />

      <div className="flex items-center gap-2 px-3.5 py-2.5 bg-[#fbe7ec] border-b border-[#f1b4c0]">
        <div className="w-6 h-6 rounded-[8px] bg-[#e11d48] flex items-center justify-center shrink-0 shadow-[0_1px_2px_rgba(225,29,72,0.35)]">
          <UserCheck size={13} className="text-white" strokeWidth={2.2} />
        </div>
        <span className="text-[13px] font-semibold text-[#181d26] tracking-ui truncate flex-1">
          {data.label}
        </span>
        {cfg?.approvalRequired && (
          <span className="shrink-0 rounded-[6px] bg-[#e11d48] px-1.5 py-0.5 text-[10px] font-semibold text-white tracking-caption">
            Approval
          </span>
        )}
      </div>

      <div className="px-3.5 py-3 space-y-2">
        {data.description && (
          <p className="text-[12px] text-[rgba(4,14,32,0.69)] leading-relaxed tracking-ui">
            {data.description}
          </p>
        )}
        {cfg?.prompt && (
          <p className="text-[11px] text-[rgba(4,14,32,0.55)] italic leading-relaxed border-l-2 border-[#f1b4c0] pl-2.5">
            “{cfg.prompt}”
          </p>
        )}
        {cfg?.timeoutSeconds && (
          <p className="text-[10px] text-[rgba(4,14,32,0.55)] tracking-caption font-medium border-t border-[#e0e2e6] pt-2">
            Timeout: {cfg.timeoutSeconds}s
          </p>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-[#e11d48] !border-white !w-[9px] !h-[9px]"
      />
      </div>
    </div>
  );
}
