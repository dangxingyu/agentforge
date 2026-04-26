'use client';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useRunStore, type NodeRunStatus } from '@/store/runStore';

interface Props {
  nodeId: string;
}

/** Small floating status pip on a node card, driven by the run store.
 * Renders nothing when the node hasn't been touched by the current run. */
export default function NodeRunBadge({ nodeId }: Props) {
  const state = useRunStore((s) => s.nodes[nodeId]);
  if (!state) return null;
  const variant = STYLES[state.status];
  if (!variant) return null;

  return (
    <div
      className={`absolute -top-2 -right-2 flex items-center gap-1 rounded-full px-1.5 py-[2px] text-[9px] font-bold tracking-caption uppercase border z-10 ${variant.bg}`}
      title={state.error ?? state.status}
    >
      {variant.icon}
      {variant.label}
    </div>
  );
}

const STYLES: Record<NodeRunStatus, { bg: string; icon: React.ReactNode; label: string } | null> = {
  idle: null,
  running: {
    bg: 'bg-[#eef3fb] border-[#1b61c9] text-[#1b61c9] shadow-[0_2px_6px_rgba(45,127,249,0.30)]',
    icon: <Loader2 size={9} strokeWidth={2.5} className="animate-spin" />,
    label: 'Running',
  },
  done: {
    bg: 'bg-[#e7f6ee] border-[#15803d] text-[#15803d] shadow-[0_2px_6px_rgba(22,163,74,0.20)]',
    icon: <CheckCircle2 size={9} strokeWidth={2.5} />,
    label: 'Done',
  },
  error: {
    bg: 'bg-[#fdf2f4] border-[#be123c] text-[#be123c] shadow-[0_2px_6px_rgba(190,18,60,0.22)]',
    icon: <AlertCircle size={9} strokeWidth={2.5} />,
    label: 'Error',
  },
};
