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
      className={`w-56 rounded-xl border bg-slate-900 shadow-xl transition-all ${
        selected ? 'border-cyan-400 shadow-cyan-500/20 shadow-2xl' : 'border-cyan-800/60'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-cyan-700 !border-cyan-500 !w-2.5 !h-2.5" />

      <div className="flex items-center gap-2 rounded-t-xl bg-cyan-950/80 px-3 py-2 border-b border-cyan-900/60">
        <Merge size={14} className="text-cyan-400 shrink-0" />
        <span className="text-xs font-semibold text-cyan-200 truncate">{data.label}</span>
      </div>

      <div className="px-3 py-2.5 space-y-1.5">
        {data.description && (
          <p className="text-[11px] text-slate-400">{data.description}</p>
        )}
        {cfg && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-cyan-600 font-medium">Strategy</span>
            <span className="rounded bg-cyan-900/50 border border-cyan-800/50 px-1.5 py-0.5 text-[10px] text-cyan-300">
              {STRATEGY_LABEL[cfg.strategy] ?? cfg.strategy}
            </span>
          </div>
        )}
        {cfg?.selectionCriteria && (
          <p className="text-[10px] text-slate-500 font-mono">{cfg.selectionCriteria}</p>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-cyan-700 !border-cyan-500 !w-2.5 !h-2.5" />
    </div>
  );
}
