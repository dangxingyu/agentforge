'use client';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { NodeData } from '@/types/pipeline';
import { Wrench } from 'lucide-react';

export default function ToolNode({ data, selected }: NodeProps<NodeData>) {
  const cfg = data.toolConfig;

  return (
    <div
      className={`w-56 rounded-xl border bg-slate-900 shadow-xl transition-all ${
        selected ? 'border-orange-400 shadow-orange-500/20 shadow-2xl' : 'border-orange-800/60'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-orange-700 !border-orange-500 !w-2.5 !h-2.5" />

      <div className="flex items-center gap-2 rounded-t-xl bg-orange-950/80 px-3 py-2 border-b border-orange-900/60">
        <Wrench size={14} className="text-orange-400 shrink-0" />
        <span className="text-xs font-semibold text-orange-200 truncate">{data.label}</span>
      </div>

      <div className="px-3 py-2.5 space-y-1.5">
        {cfg?.toolName && (
          <div className="flex items-center gap-2">
            <span className="rounded bg-orange-900/50 border border-orange-800/50 px-1.5 py-0.5 text-[10px] font-mono text-orange-300">
              {cfg.toolName}
            </span>
          </div>
        )}
        {data.description && (
          <p className="text-[11px] text-slate-400">{data.description}</p>
        )}
        {cfg?.apiEndpoint && (
          <p className="text-[10px] text-slate-500 font-mono truncate">{cfg.apiEndpoint}</p>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-orange-700 !border-orange-500 !w-2.5 !h-2.5" />
    </div>
  );
}
