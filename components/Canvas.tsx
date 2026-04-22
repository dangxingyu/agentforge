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

export default function Canvas() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, selectNode, selectedNodeId } =
    usePipelineStore();

  return (
    <div className="w-full h-full bg-[#080810]">
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
        fitViewOptions={{ padding: 0.15 }}
        defaultEdgeOptions={{
          style: { stroke: '#4f4f7a', strokeWidth: 2 },
          labelStyle: { fill: '#94a3b8', fontSize: 11 },
          labelBgStyle: { fill: '#1e1e2d', fillOpacity: 0.9 },
          labelBgPadding: [6, 4],
          labelBgBorderRadius: 4,
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="#1e1e2d"
        />
        <Controls
          className="!bg-slate-900 !border-slate-700 [&>button]:!bg-slate-900 [&>button]:!border-slate-700 [&>button]:!fill-slate-400 [&>button:hover]:!bg-slate-800"
        />
        <MiniMap
          className="!bg-slate-900 !border-slate-700"
          nodeColor={(node) => {
            const colors: Record<string, string> = {
              llm_agent: '#4f46e5',
              decision: '#d97706',
              parallel: '#16a34a',
              aggregator: '#0891b2',
              loop: '#7c3aed',
              input: '#475569',
              output: '#6d28d9',
              tool: '#c2410c',
              human: '#be123c',
            };
            return colors[node.type ?? ''] ?? '#475569';
          }}
          maskColor="rgba(0,0,0,0.7)"
        />
      </ReactFlow>
    </div>
  );
}
