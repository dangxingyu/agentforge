'use client';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { NodeData } from '@/types/pipeline';
import { GitBranch } from 'lucide-react';

export default function DecisionNode({ data, selected }: NodeProps<NodeData>) {
  const cfg = data.decisionConfig;

  return (
    <div
      className={`w-56 rounded-xl border bg-slate-900 shadow-xl transition-all ${
        selected ? 'border-amber-400 shadow-amber-500/20 shadow-2xl' : 'border-amber-800/60'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-amber-700 !border-amber-500 !w-2.5 !h-2.5" />

      <div className="flex items-center gap-2 rounded-t-xl bg-amber-950/80 px-3 py-2 border-b border-amber-900/60">
        <GitBranch size={14} className="text-amber-400 shrink-0" />
        <span className="text-xs font-semibold text-amber-200 truncate">{data.label}</span>
      </div>

      <div className="px-3 py-2.5 space-y-1.5">
        {data.description && (
          <p className="text-[11px] text-slate-400">{data.description}</p>
        )}
        {cfg && (
          <div className="rounded-lg bg-amber-950/40 border border-amber-900/40 px-2.5 py-1.5">
            <p className="text-[10px] uppercase tracking-wider text-amber-600 font-medium mb-1">Condition</p>
            <code className="text-[11px] text-amber-300 font-mono">{cfg.condition}</code>
          </div>
        )}
        {cfg && (
          <div className="flex gap-2 mt-1">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-[10px] text-green-400">{cfg.trueLabel}</span>
            </div>
            <div className="flex items-center gap-1 ml-auto">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-[10px] text-red-400">{cfg.falseLabel}</span>
            </div>
          </div>
        )}
      </div>

      {/* Two source handles */}
      <Handle
        type="source"
        position={Position.Right}
        id="true"
        style={{ top: '60%' }}
        className="!bg-green-600 !border-green-400 !w-2.5 !h-2.5"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        className="!bg-red-600 !border-red-400 !w-2.5 !h-2.5"
      />
    </div>
  );
}
