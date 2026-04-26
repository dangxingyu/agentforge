'use client';
import { Handle, Position, type NodeProps } from 'reactflow';
import { useStore as useFlowStore } from 'reactflow';
import { useMemo } from 'react';
import type { NodeData } from '@/types/pipeline';
import { Merge, AlertTriangle } from 'lucide-react';
import { collectUpstreamSchemas } from '@/lib/pipeline';
import { extractRefsByRegex } from '@/lib/expression';
import { useRunStore } from '@/store/runStore';
import ConditionTokens from './ConditionTokens';
import NodeRunBadge from './NodeRunBadge';

const STRATEGY_LABEL: Record<string, string> = {
  all: 'Collect all',
  best: 'Keep best',
  vote: 'Majority vote',
  first: 'First done',
  concat: 'Concatenate',
};

export default function AggregatorNode({ id, data, selected }: NodeProps<NodeData>) {
  const cfg = data.aggregatorConfig;
  const usesCriteria = cfg?.strategy === 'best' || cfg?.strategy === 'vote';

  const nodes = useFlowStore((s) => s.getNodes());
  const edges = useFlowStore((s) => s.edges);
  const upstream = useMemo(
    () => collectUpstreamSchemas(id, nodes, edges),
    [id, nodes, edges]
  );

  const refs = useMemo(
    () => (usesCriteria ? extractRefsByRegex(cfg?.selectionCriteria ?? '') : []),
    [cfg?.selectionCriteria, usesCriteria]
  );
  const unresolved = refs.filter(
    (r) => !upstream.some((u) => u.role === r.role && u.field.name === r.field)
  );

  const runStatus = useRunStore((s) => s.nodes[id]?.status);

  return (
    <div className="relative">
      <NodeRunBadge nodeId={id} />
      <div
        className={`w-60 rounded-[16px] bg-white overflow-hidden transition-all ${
          selected
            ? 'border border-[#0891b2] shadow-[0_0_0_3px_rgba(8,145,178,0.18),0_1px_3px_rgba(8,145,178,0.20)]'
            : 'border border-[#e0e2e6] shadow-[0_1px_2px_rgba(15,48,106,0.04),0_4px_14px_rgba(15,48,106,0.06)] hover:border-[#cbd0d7]'
        } ${runStatus === 'running' ? 'ring-2 ring-[#0891b2] ring-offset-2 ring-offset-[#f8fafc]' : ''}`}
      >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-[#0891b2] !border-white !w-[9px] !h-[9px]"
      />

      <div className="flex items-center gap-2 px-3.5 py-2.5 bg-[#e3f4f7] border-b border-[#a3d1dc]">
        <div className="w-6 h-6 rounded-[8px] bg-[#0891b2] flex items-center justify-center shrink-0 shadow-[0_1px_2px_rgba(8,145,178,0.35)]">
          <Merge size={13} className="text-white" strokeWidth={2.2} />
        </div>
        <span className="text-[13px] font-semibold text-[#181d26] tracking-ui truncate flex-1">
          {data.label}
        </span>
        {unresolved.length > 0 && (
          <span
            className="shrink-0 flex items-center gap-1 rounded-[6px] bg-[#fdf2f4] border border-[#f1b4c0] px-1.5 py-0.5 text-[9px] font-semibold text-[#be123c] tracking-caption"
            title={`${unresolved.length} unresolved reference${unresolved.length > 1 ? 's' : ''}`}
          >
            <AlertTriangle size={9} strokeWidth={2.5} />
            {unresolved.length}
          </span>
        )}
      </div>

      <div className="px-3.5 py-3 space-y-2">
        {data.description && (
          <p className="text-[12px] text-[rgba(4,14,32,0.69)] leading-relaxed tracking-ui">
            {data.description}
          </p>
        )}
        {cfg && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-caption text-[rgba(4,14,32,0.55)] font-semibold">
              Strategy
            </span>
            <span className="rounded-[6px] bg-[#e3f4f7] border border-[#a3d1dc] px-2 py-0.5 text-[11px] text-[#0e7490] font-semibold tracking-ui">
              {STRATEGY_LABEL[cfg.strategy] ?? cfg.strategy}
            </span>
          </div>
        )}
        {usesCriteria && cfg?.selectionCriteria && (
          <div className="rounded-[10px] bg-[#f0fafd] border border-[#a3d1dc] px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-caption text-[#0e7490] font-semibold mb-1">
              {cfg.strategy === 'best' ? 'Maximize' : 'Vote on'}
            </p>
            <ConditionTokens
              expression={cfg.selectionCriteria}
              upstream={upstream}
              accentText="text-[#0e7490]"
            />
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-[#0891b2] !border-white !w-[9px] !h-[9px]"
      />
      </div>
    </div>
  );
}
