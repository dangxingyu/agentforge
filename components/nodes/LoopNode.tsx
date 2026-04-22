'use client';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { NodeData } from '@/types/pipeline';
import { RefreshCw } from 'lucide-react';

export default function LoopNode({ data, selected }: NodeProps<NodeData>) {
  const cfg = data.loopConfig;

  return (
    <div
      className={`w-56 rounded-xl border bg-slate-900 shadow-xl transition-all ${
        selected ? 'border-purple-400 shadow-purple-500/20 shadow-2xl' : 'border-purple-800/60'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-purple-700 !border-purple-500 !w-2.5 !h-2.5" />

      <div className="flex items-center gap-2 rounded-t-xl bg-purple-950/80 px-3 py-2 border-b border-purple-900/60">
        <RefreshCw size={14} className="text-purple-400 shrink-0" />
        <span className="text-xs font-semibold text-purple-200 truncate">{data.label}</span>
        {cfg && (
          <span className="ml-auto shrink-0 rounded bg-purple-800/80 border border-purple-700 px-1.5 py-0.5 text-[10px] font-medium text-purple-300">
            max {cfg.maxIterations}×
          </span>
        )}
      </div>

      <div className="px-3 py-2.5 space-y-1.5">
        {data.description && (
          <p className="text-[11px] text-slate-400">{data.description}</p>
        )}
        {cfg && (
          <div className="rounded-lg bg-purple-950/40 border border-purple-900/40 px-2.5 py-1.5">
            <p className="text-[10px] uppercase tracking-wider text-purple-600 font-medium mb-0.5">Break when</p>
            <code className="text-[11px] text-purple-300 font-mono">{cfg.breakCondition}</code>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-purple-700 !border-purple-500 !w-2.5 !h-2.5" />
    </div>
  );
}
