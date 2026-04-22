'use client';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { NodeData } from '@/types/pipeline';
import { Wrench } from 'lucide-react';

export default function ToolNode({ data, selected }: NodeProps<NodeData>) {
  const cfg = data.toolConfig;

  return (
    <div
      className={`w-60 rounded-[16px] bg-white overflow-hidden transition-all ${
        selected
          ? 'border border-[#ea580c] shadow-[0_0_0_3px_rgba(234,88,12,0.18),0_1px_3px_rgba(234,88,12,0.20)]'
          : 'border border-[#e0e2e6] shadow-[0_1px_2px_rgba(15,48,106,0.04),0_4px_14px_rgba(15,48,106,0.06)] hover:border-[#cbd0d7]'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-[#ea580c] !border-white !w-[9px] !h-[9px]"
      />

      <div className="flex items-center gap-2 px-3.5 py-2.5 bg-[#fdebdd] border-b border-[#f1bd92]">
        <div className="w-6 h-6 rounded-[8px] bg-[#ea580c] flex items-center justify-center shrink-0 shadow-[0_1px_2px_rgba(234,88,12,0.35)]">
          <Wrench size={13} className="text-white" strokeWidth={2.2} />
        </div>
        <span className="text-[13px] font-semibold text-[#181d26] tracking-ui truncate">
          {data.label}
        </span>
      </div>

      <div className="px-3.5 py-3 space-y-2">
        {cfg?.toolName && (
          <div>
            <span className="rounded-[6px] bg-[#fdebdd] border border-[#f1bd92] px-2 py-0.5 text-[11px] font-mono text-[#c2410c] font-semibold">
              {cfg.toolName}
            </span>
          </div>
        )}
        {data.description && (
          <p className="text-[12px] text-[rgba(4,14,32,0.69)] leading-relaxed tracking-ui">
            {data.description}
          </p>
        )}
        {cfg?.apiEndpoint && (
          <p className="text-[10px] text-[rgba(4,14,32,0.55)] font-mono truncate border-t border-[#e0e2e6] pt-2">
            {cfg.apiEndpoint}
          </p>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-[#ea580c] !border-white !w-[9px] !h-[9px]"
      />
    </div>
  );
}
