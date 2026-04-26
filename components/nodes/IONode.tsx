'use client';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { NodeData } from '@/types/pipeline';
import { ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import NodeRunBadge from './NodeRunBadge';
import { useRunStore } from '@/store/runStore';

export default function IONode({ id, data, selected, type }: NodeProps<NodeData>) {
  const isInput = type === 'input';
  const accent = isInput ? '#64748b' : '#6d28d9';
  const bg = isInput ? '#f1f4f8' : '#ece6f8';
  const border = isInput ? '#d1d5db' : '#c5b4e8';
  const shadowRgb = isInput ? '100, 116, 139' : '109, 40, 217';

  const runStatus = useRunStore((s) => s.nodes[id]?.status);

  return (
    <div className="relative">
      <NodeRunBadge nodeId={id} />
      <div
        className={`w-52 rounded-[16px] bg-white overflow-hidden transition-all ${
          selected
            ? `border shadow-[0_0_0_3px_rgba(${shadowRgb},0.18),0_1px_3px_rgba(${shadowRgb},0.20)]`
            : 'border border-[#e0e2e6] shadow-[0_1px_2px_rgba(15,48,106,0.04),0_4px_14px_rgba(15,48,106,0.06)] hover:border-[#cbd0d7]'
        } ${runStatus === 'running' ? 'ring-2 ring-offset-2 ring-offset-[#f8fafc]' : ''}`}
        style={
          selected
            ? { borderColor: accent }
            : runStatus === 'running'
              ? ({ '--tw-ring-color': accent } as React.CSSProperties)
              : undefined
        }
      >
      {!isInput && (
        <Handle
          type="target"
          position={Position.Top}
          className="!border-white !w-[9px] !h-[9px]"
          style={{ background: accent }}
        />
      )}

      <div
        className="flex items-center gap-2 px-3.5 py-2.5 border-b"
        style={{ backgroundColor: bg, borderBottomColor: border }}
      >
        <div
          className="w-6 h-6 rounded-[8px] flex items-center justify-center shrink-0"
          style={{
            backgroundColor: accent,
            boxShadow: `0 1px 2px rgba(${shadowRgb}, 0.35)`,
          }}
        >
          {isInput ? (
            <ArrowDownCircle size={13} className="text-white" strokeWidth={2.2} />
          ) : (
            <ArrowUpCircle size={13} className="text-white" strokeWidth={2.2} />
          )}
        </div>
        <span className="text-[13px] font-semibold text-[#181d26] tracking-ui truncate">
          {data.label}
        </span>
        <span
          className="ml-auto text-[9px] uppercase tracking-caption font-bold"
          style={{ color: accent }}
        >
          {isInput ? 'IN' : 'OUT'}
        </span>
      </div>

      {data.description && (
        <div className="px-3.5 py-2.5">
          <p className="text-[12px] text-[rgba(4,14,32,0.69)] leading-relaxed tracking-ui">
            {data.description}
          </p>
        </div>
      )}

      {isInput && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!border-white !w-[9px] !h-[9px]"
          style={{ background: accent }}
        />
      )}
      </div>
    </div>
  );
}
