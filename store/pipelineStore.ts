import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { applyNodeChanges, applyEdgeChanges, addEdge } from 'reactflow';
import type { NodeChange, EdgeChange, Connection } from 'reactflow';
import type { FlowNode, FlowEdge, NodeData, ChatMessage, DesignerPhase, Pipeline, FormQuestion } from '@/types/pipeline';
import { getTemplate } from '@/lib/templates';

// ─── Storage helpers ─────────────────────────────────────────────────────

const noopStorage: Storage = {
  length: 0,
  clear: () => {},
  getItem: () => null,
  key: () => null,
  removeItem: () => {},
  setItem: () => {},
};

/** Wraps localStorage so QuotaExceededError doesn't tank the whole app —
 * we log a warning and continue. Persistence becomes a best-effort feature. */
function wrapLocalStorageWithErrorHandling(ls: Storage): Storage {
  return {
    ...ls,
    getItem: (key) => {
      try {
        return ls.getItem(key);
      } catch (err) {
        console.warn('[AgentForge] localStorage.getItem failed:', err);
        return null;
      }
    },
    setItem: (key, value) => {
      try {
        ls.setItem(key, value);
      } catch (err) {
        console.warn(
          '[AgentForge] localStorage.setItem failed (likely over quota — your pipeline edits won\'t persist):',
          err
        );
      }
    },
    removeItem: (key) => {
      try {
        ls.removeItem(key);
      } catch {
        /* ignore */
      }
    },
  };
}

interface PipelineStore {
  nodes: FlowNode[];
  edges: FlowEdge[];
  pipeline: Omit<Pipeline, 'nodes' | 'edges'> | null;
  selectedNodeId: string | null;
  messages: ChatMessage[];
  phase: DesignerPhase;
  isStreaming: boolean;
  activeTemplateId: string | null;
  /** True once persisted state has been read from localStorage. UI uses
   * this to avoid prematurely loading the default template before
   * hydration finishes. */
  _hasHydrated: boolean;

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
  resetPipeline: () => void;
  _setHydrated: () => void;
}

function newMessageId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const usePipelineStore = create<PipelineStore>()(
  persist(
    (set) => ({
      nodes: [],
      edges: [],
      pipeline: null,
      selectedNodeId: null,
      messages: [],
      phase: 'initial',
      isStreaming: false,
      activeTemplateId: null,
      _hasHydrated: false,

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
          // Deep-clone so user edits don't mutate the template module export
          // (which would persist garbage on next load and survive hot reload).
          nodes: JSON.parse(JSON.stringify(tpl.pipeline.nodes)) as FlowNode[],
          edges: JSON.parse(JSON.stringify(tpl.pipeline.edges)) as FlowEdge[],
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
          id: newMessageId(),
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

      resetPipeline: () =>
        set({
          nodes: [],
          edges: [],
          pipeline: null,
          selectedNodeId: null,
          activeTemplateId: null,
        }),

      _setHydrated: () => set({ _hasHydrated: true }),
    }),
    {
      name: 'agentforge-pipeline-v1',
      version: 2,
      // Defensive storage: localStorage may be unavailable in private mode
      // / over quota / corrupted. Falling back to a noop keeps the app
      // booting even when persistence is broken.
      storage: createJSONStorage(() => {
        if (typeof window === 'undefined') return noopStorage;
        try {
          const probe = '__agentforge_probe__';
          window.localStorage.setItem(probe, probe);
          window.localStorage.removeItem(probe);
          return wrapLocalStorageWithErrorHandling(window.localStorage);
        } catch {
          return noopStorage;
        }
      }),
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
        pipeline: state.pipeline,
        activeTemplateId: state.activeTemplateId,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.warn('[AgentForge] Failed to rehydrate pipeline state:', error);
        }
        // Mark hydrated regardless of error — the UI should still load
        // (possibly with empty state) rather than block forever.
        state?._setHydrated();
      },
      migrate: (persisted, version) => {
        // v1 → v2: outputSchema field added to LLMAgentConfig. Older
        // persisted pipelines won't have it; the app treats it as
        // optional, so no rewrite is necessary. Just bump the version.
        if (version < 2) return persisted;
        return persisted;
      },
    }
  )
);
