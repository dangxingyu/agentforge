'use client';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { NodeData } from '@/types/pipeline';
import { ArrowDownCircle, ArrowUpCircle } from 'lucide-react';

export default function IONode({ data, selected, type: nodeType }: NodeProps<NodeData> & { type?: string }) {
  const isInput = nodeType === 'input';
  const colorClass = isInput
    ? selected ? 'border-slate-400 shadow-slate-400/20 shadow-2xl' : 'border-slate-600'
    : selected ? 'border-violet-400 shadow-violet-400/20 shadow-2xl' : 'border-violet-700/60';
  const headerClass = isInput ? 'bg-slate-800/80 border-slate-700' : 'bg-violet-950/80 border-violet-900/60';
  const iconClass = isInput ? 'text-slate-400' : 'text-violet-400';
  const textClass = isInput ? 'text-slate-200' : 'text-violet-200';

  return (
    <div className={`w-48 rounded-xl border bg-slate-900 shadow-xl transition-all ${colorClass}`}>
      {!isInput && (
        <Handle type="target" position={Position.Top} className="!bg-violet-700 !border-violet-500 !w-2.5 !h-2.5" />
      )}

      <div className={`flex items-center gap-2 rounded-t-xl px-3 py-2 border-b ${headerClass}`}>
        {isInput ? (
          <ArrowDownCircle size={14} className={iconClass} />
        ) : (
          <ArrowUpCircle size={14} className={iconClass} />
        )}
        <span className={`text-xs font-semibold truncate ${textClass}`}>{data.label}</span>
      </div>

      {data.description && (
        <div className="px-3 py-2">
          <p className="text-[11px] text-slate-400">{data.description}</p>
        </div>
      )}

      {isInput && (
        <Handle type="source" position={Position.Bottom} className="!bg-slate-500 !border-slate-400 !w-2.5 !h-2.5" />
      )}
    </div>
  );
}
