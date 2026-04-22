import { create } from 'zustand';
import { applyNodeChanges, applyEdgeChanges, addEdge } from 'reactflow';
import type { NodeChange, EdgeChange, Connection } from 'reactflow';
import type { FlowNode, FlowEdge, NodeData, ChatMessage, DesignerPhase, Pipeline, FormQuestion } from '@/types/pipeline';
import { getTemplate } from '@/lib/templates';
import { generatePipelineId } from '@/lib/pipeline';

interface PipelineStore {
  nodes: FlowNode[];
  edges: FlowEdge[];
  pipeline: Omit<Pipeline, 'nodes' | 'edges'> | null;
  selectedNodeId: string | null;
  messages: ChatMessage[];
  phase: DesignerPhase;
  isStreaming: boolean;
  activeTemplateId: string | null;

  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  setNodes: (nodes: FlowNode[]) => void;
  setEdges: (edges: FlowEdge[]) => void;
  updateNodeData: (id: string, data: Partial<NodeData>) => void;
  selectNode: (id: string | null) => void;
  loadTemplate: (templateId: string) => void;
  loadPipeline: (pipeline: Pipeline) => void;
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'> & { formQuestions?: FormQuestion[] }) => void;
  appendToLastMessage: (chunk: string) => void;
  setPhase: (phase: DesignerPhase) => void;
  setStreaming: (streaming: boolean) => void;
  clearMessages: () => void;
}

export const usePipelineStore = create<PipelineStore>((set, get) => ({
  nodes: [],
  edges: [],
  pipeline: null,
  selectedNodeId: null,
  messages: [],
  phase: 'initial',
  isStreaming: false,
  activeTemplateId: null,

  onNodesChange: (changes) =>
    set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) as FlowNode[] })),

  onEdgesChange: (changes) =>
    set((s) => ({ edges: applyEdgeChanges(changes, s.edges) })),

  onConnect: (connection) =>
    set((s) => ({ edges: addEdge({ ...connection, animated: true }, s.edges) })),

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  updateNodeData: (id, data) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...data } } : n
      ),
    })),

  selectNode: (id) => set({ selectedNodeId: id }),

  loadTemplate: (templateId) => {
    const tpl = getTemplate(templateId);
    if (!tpl) return;
    set({
      nodes: tpl.pipeline.nodes as FlowNode[],
      edges: tpl.pipeline.edges,
      pipeline: {
        id: tpl.pipeline.id,
        name: tpl.pipeline.name,
        description: tpl.pipeline.description,
        createdAt: tpl.pipeline.createdAt,
        updatedAt: tpl.pipeline.updatedAt,
      },
      selectedNodeId: null,
      activeTemplateId: templateId,
    });
  },

  loadPipeline: (pipeline) => {
    set({
      nodes: pipeline.nodes as FlowNode[],
      edges: pipeline.edges,
      pipeline: {
        id: pipeline.id,
        name: pipeline.name,
        description: pipeline.description,
        createdAt: pipeline.createdAt,
        updatedAt: pipeline.updatedAt,
      },
      selectedNodeId: null,
      activeTemplateId: null,
    });
  },

  addMessage: (msg) => {
    const message: ChatMessage = {
      ...msg,
      id: `msg_${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
    set((s) => ({ messages: [...s.messages, message] }));
  },

  appendToLastMessage: (chunk) => {
    set((s) => {
      const msgs = [...s.messages];
      if (msgs.length === 0) return s;
      const last = { ...msgs[msgs.length - 1], content: msgs[msgs.length - 1].content + chunk };
      msgs[msgs.length - 1] = last;
      return { messages: msgs };
    });
  },

  setPhase: (phase) => set({ phase }),
  setStreaming: (isStreaming) => set({ isStreaming }),
  clearMessages: () => set({ messages: [], phase: 'initial' }),
}));
