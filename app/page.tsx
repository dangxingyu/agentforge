'use client';
import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { usePipelineStore } from '@/store/pipelineStore';
import ChatPanel from '@/components/ChatPanel';
import NodeDetail from '@/components/NodeDetail';
import Toolbar from '@/components/Toolbar';

// Canvas must be client-only (React Flow uses browser APIs)
const Canvas = dynamic(() => import('@/components/Canvas'), { ssr: false });

export default function Home() {
  const { loadTemplate, selectedNodeId } = usePipelineStore();

  useEffect(() => {
    loadTemplate('momus');
  }, [loadTemplate]);

  return (
    <div className="flex flex-col h-screen bg-[#080810] text-slate-200 overflow-hidden">
      <Toolbar />
      <div className="flex flex-1 min-h-0">
        {/* Left: Chat / Pipeline Designer */}
        <div className="w-80 shrink-0 border-r border-slate-800 overflow-hidden">
          <ChatPanel />
        </div>

        {/* Center: Canvas */}
        <div className="flex-1 min-w-0 relative">
          <Canvas />
        </div>

        {/* Right: Node detail panel */}
        <div
          className={`shrink-0 overflow-hidden border-l border-slate-800 transition-all duration-300 ${
            selectedNodeId ? 'w-96' : 'w-0'
          }`}
        >
          <div className="w-96 h-full">
            <NodeDetail />
          </div>
        </div>
      </div>
    </div>
  );
}
