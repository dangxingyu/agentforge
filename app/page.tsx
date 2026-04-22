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
    <div className="flex flex-col h-screen bg-white text-[#181d26] overflow-hidden">
      <Toolbar />
      <div className="flex flex-1 min-h-0">
        {/* Left: Chat / Pipeline Designer */}
        <div className="w-[340px] shrink-0 border-r border-[#e0e2e6] overflow-hidden bg-white">
          <ChatPanel />
        </div>

        {/* Center: Canvas */}
        <div className="flex-1 min-w-0 relative bg-[#f8fafc]">
          <Canvas />
        </div>

        {/* Right: Node detail panel */}
        <div
          className={`shrink-0 overflow-hidden border-l border-[#e0e2e6] bg-white transition-all duration-300 ease-[cubic-bezier(0.22,0.61,0.36,1)] ${
            selectedNodeId ? 'w-[400px]' : 'w-0'
          }`}
        >
          <div className="w-[400px] h-full">
            <NodeDetail />
          </div>
        </div>
      </div>
    </div>
  );
}
