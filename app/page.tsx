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
  const hasHydrated = usePipelineStore((s) => s._hasHydrated);
  const nodeCount = usePipelineStore((s) => s.nodes.length);
  const loadTemplate = usePipelineStore((s) => s.loadTemplate);
  const selectedNodeId = usePipelineStore((s) => s.selectedNodeId);

  // Only fall back to the default Momus template when (a) the persist
  // middleware has finished reading localStorage and (b) there's no
  // pipeline already in the store. This prevents clobbering the user's
  // saved work on reload and avoids a flash of the default template.
  useEffect(() => {
    if (hasHydrated && nodeCount === 0) {
      loadTemplate('momus');
    }
  }, [hasHydrated, nodeCount, loadTemplate]);

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
