'use client';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { NodeData } from '@/types/pipeline';
import { UserCheck } from 'lucide-react';

export default function HumanNode({ data, selected }: NodeProps<NodeData>) {
  const cfg = data.humanConfig;

  return (
    <div
      className={`w-56 rounded-xl border bg-slate-900 shadow-xl transition-all ${
        selected ? 'border-rose-400 shadow-rose-500/20 shadow-2xl' : 'border-rose-800/60'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-rose-700 !border-rose-500 !w-2.5 !h-2.5" />

      <div className="flex items-center gap-2 rounded-t-xl bg-rose-950/80 px-3 py-2 border-b border-rose-900/60">
        <UserCheck size={14} className="text-rose-400 shrink-0" />
        <span className="text-xs font-semibold text-rose-200 truncate">{data.label}</span>
        {cfg?.approvalRequired && (
          <span className="ml-auto shrink-0 rounded bg-rose-800/80 border border-rose-700 px-1.5 py-0.5 text-[10px] font-medium text-rose-300">
            Approval
          </span>
        )}
      </div>

      <div className="px-3 py-2.5 space-y-1.5">
        {data.description && (
          <p className="text-[11px] text-slate-400">{data.description}</p>
        )}
        {cfg?.prompt && (
          <p className="text-[11px] text-slate-500 italic">"{cfg.prompt}"</p>
        )}
        {cfg?.timeoutSeconds && (
          <p className="text-[10px] text-slate-500">Timeout: {cfg.timeoutSeconds}s</p>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-rose-700 !border-rose-500 !w-2.5 !h-2.5" />
    </div>
  );
}
