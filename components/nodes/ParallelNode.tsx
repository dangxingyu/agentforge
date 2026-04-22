'use client';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { NodeData } from '@/types/pipeline';
import { Zap } from 'lucide-react';

export default function ParallelNode({ data, selected }: NodeProps<NodeData>) {
  const cfg = data.parallelConfig;

  return (
    <div
      className={`w-56 rounded-xl border bg-slate-900 shadow-xl transition-all ${
        selected ? 'border-green-400 shadow-green-500/20 shadow-2xl' : 'border-green-800/60'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-green-700 !border-green-500 !w-2.5 !h-2.5" />

      <div className="flex items-center gap-2 rounded-t-xl bg-green-950/80 px-3 py-2 border-b border-green-900/60">
        <Zap size={14} className="text-green-400 shrink-0" />
        <span className="text-xs font-semibold text-green-200 truncate">{data.label}</span>
        {cfg && (
          <span className="ml-auto shrink-0 rounded-full bg-green-800/80 border border-green-700 px-2 py-0.5 text-[10px] font-bold text-green-300">
            ×{cfg.numParallel}
          </span>
        )}
      </div>

      <div className="px-3 py-2.5 space-y-1.5">
        {data.description && (
          <p className="text-[11px] text-slate-400">{data.description}</p>
        )}
        {cfg && (
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {Array.from({ length: Math.min(cfg.numParallel, 6) }).map((_, i) => (
                <div key={i} className="w-3 h-5 rounded-sm bg-green-800/60 border border-green-700/50" />
              ))}
              {cfg.numParallel > 6 && <span className="text-[10px] text-green-600">+{cfg.numParallel - 6}</span>}
            </div>
            <span className="text-[10px] text-green-500">{cfg.label ?? 'parallel instances'}</span>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-green-700 !border-green-500 !w-2.5 !h-2.5" />
    </div>
  );
}
