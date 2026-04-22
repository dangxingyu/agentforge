'use client';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type NodeTypes,
} from 'reactflow';
import { usePipelineStore } from '@/store/pipelineStore';
import AgentNode from './nodes/AgentNode';
import DecisionNode from './nodes/DecisionNode';
import ParallelNode from './nodes/ParallelNode';
import AggregatorNode from './nodes/AggregatorNode';
import LoopNode from './nodes/LoopNode';
import IONode from './nodes/IONode';
import ToolNode from './nodes/ToolNode';
import HumanNode from './nodes/HumanNode';

const nodeTypes: NodeTypes = {
  llm_agent: AgentNode,
  decision: DecisionNode,
  parallel: ParallelNode,
  aggregator: AggregatorNode,
  loop: LoopNode,
  input: IONode,
  output: IONode,
  tool: ToolNode,
  human: HumanNode,
};

const NODE_COLORS: Record<string, string> = {
  llm_agent: '#1b61c9',
  decision: '#d97706',
  parallel: '#16a34a',
  aggregator: '#0891b2',
  loop: '#7c3aed',
  input: '#64748b',
  output: '#6d28d9',
  tool: '#ea580c',
  human: '#e11d48',
};

export default function Canvas() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, selectNode, selectedNodeId } =
    usePipelineStore();

  return (
    <div className="w-full h-full bg-[#f8fafc]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => selectNode(node.id === selectedNodeId ? null : node.id)}
        onPaneClick={() => selectNode(null)}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        defaultEdgeOptions={{
          style: { stroke: '#94a3b8', strokeWidth: 1.75 },
          labelStyle: {
            fill: 'rgba(4,14,32,0.69)',
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: '0.2px',
          },
          labelBgStyle: { fill: '#ffffff', fillOpacity: 1, stroke: '#e0e2e6' },
          labelBgPadding: [6, 4],
          labelBgBorderRadius: 6,
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={22}
          size={1}
          color="#cfd6df"
        />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(node) => NODE_COLORS[node.type ?? ''] ?? '#64748b'}
          nodeStrokeColor={(node) => NODE_COLORS[node.type ?? ''] ?? '#64748b'}
          nodeStrokeWidth={2}
          maskColor="rgba(15, 48, 106, 0.06)"
          pannable
          zoomable
        />
      </ReactFlow>
    </div>
  );
}
