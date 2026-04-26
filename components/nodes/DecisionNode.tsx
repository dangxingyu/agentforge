'use client';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { NodeData } from '@/types/pipeline';
import { GitBranch, AlertTriangle } from 'lucide-react';
import { useStore as useFlowStore } from 'reactflow';
import { useMemo } from 'react';
import { collectUpstreamSchemas, parseVariableRefs } from '@/lib/pipeline';
import { useRunStore } from '@/store/runStore';
import ConditionTokens from './ConditionTokens';
import NodeRunBadge from './NodeRunBadge';

export default function DecisionNode({ id, data, selected }: NodeProps<NodeData>) {
  const cfg = data.decisionConfig;

  // Subscribe to the flow's live nodes/edges so unresolved refs update in
  // real time as the user edits upstream agent schemas.
  const nodes = useFlowStore((s) => s.getNodes());
  const edges = useFlowStore((s) => s.edges);
  const upstream = useMemo(
    () => collectUpstreamSchemas(id, nodes, edges),
    [id, nodes, edges]
  );
  const refs = useMemo(
    () => parseVariableRefs(cfg?.condition ?? ''),
    [cfg?.condition]
  );
  const unresolved = refs.filter(
    (r) => !upstream.some((u) => u.role === r.role && u.field.name === r.field)
  );

  const runStatus = useRunStore((s) => s.nodes[id]?.status);

  return (
    <div className="relative">
      <NodeRunBadge nodeId={id} />
      <div
        className={`w-64 rounded-[16px] bg-white overflow-hidden transition-all ${
          selected
            ? 'border border-[#d97706] shadow-[0_0_0_3px_rgba(217,119,6,0.18),0_1px_3px_rgba(45,127,249,0.20)]'
            : 'border border-[#e0e2e6] shadow-[0_1px_2px_rgba(15,48,106,0.04),0_4px_14px_rgba(15,48,106,0.06)] hover:border-[#cbd0d7]'
        } ${runStatus === 'running' ? 'ring-2 ring-[#d97706] ring-offset-2 ring-offset-[#f8fafc]' : ''}`}
      >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-[#d97706] !border-white !w-[9px] !h-[9px]"
      />

      <div className="flex items-center gap-2 px-3.5 py-2.5 bg-[#fef4e6] border-b border-[#f5d7a0]">
        <div className="w-6 h-6 rounded-[8px] bg-[#d97706] flex items-center justify-center shrink-0 shadow-[0_1px_2px_rgba(217,119,6,0.35)]">
          <GitBranch size={13} className="text-white" strokeWidth={2.2} />
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
        {cfg && cfg.condition && (
          <div className="rounded-[10px] bg-[#fef9ef] border border-[#f5d7a0] px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-caption text-[#b45309] font-semibold mb-1">
              Condition
            </p>
            <ConditionTokens
              expression={cfg.condition}
              upstream={upstream}
              accentText="text-[#92400e]"
            />
          </div>
        )}
        {cfg && (
          <div className="flex gap-3 mt-1">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#15803d]" />
              <span className="text-[10px] tracking-caption font-semibold text-[#15803d]">
                {cfg.trueLabel}
              </span>
            </div>
            <div className="flex items-center gap-1.5 ml-auto">
              <div className="w-1.5 h-1.5 rounded-full bg-[#be123c]" />
              <span className="text-[10px] tracking-caption font-semibold text-[#be123c]">
                {cfg.falseLabel}
              </span>
            </div>
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="true"
        style={{ top: '62%' }}
        className="!bg-[#15803d] !border-white !w-[9px] !h-[9px]"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        className="!bg-[#be123c] !border-white !w-[9px] !h-[9px]"
      />
      </div>
    </div>
  );
}
