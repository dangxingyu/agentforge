import { create } from 'zustand';
import type { ExecutionEvent } from '@/lib/executor';

/**
 * Runtime state for the currently-executing (or last-executed) pipeline.
 *
 * Kept in a separate store from the pipeline designer state so a run
 * never accidentally persists across reloads, and so canvas decorations
 * can subscribe to a slim slice without re-rendering on every chat
 * message or node-data tweak.
 */

export type NodeRunStatus = 'idle' | 'running' | 'done' | 'error';

export interface NodeRunState {
  status: NodeRunStatus;
  /** Streaming partial text from the LLM, accumulated. */
  partial: string;
  /** Final output once the node completes, stringified for display. */
  output?: string;
  error?: string;
  startedAt?: number;
  finishedAt?: number;
}

export type RunStatus = 'idle' | 'running' | 'complete' | 'error';

interface RunStore {
  status: RunStatus;
  /** User input that started this run. */
  input: string;
  /** Final pipeline output. */
  output?: unknown;
  /** Top-level error message, if any. */
  error?: string;
  /** Per-node state, keyed by nodeId (parallel branches use `nodeId#i`). */
  nodes: Record<string, NodeRunState>;
  /** Append-only event log for the run panel. */
  events: ExecutionEvent[];
  /** AbortController for in-flight runs; null when idle. */
  abortController: AbortController | null;

  startRun: (input: string, abortController: AbortController) => void;
  applyEvent: (event: ExecutionEvent) => void;
  finishRun: (status: RunStatus, output?: unknown, error?: string) => void;
  resetRun: () => void;
  abort: () => void;
}

export const useRunStore = create<RunStore>((set, get) => ({
  status: 'idle',
  input: '',
  output: undefined,
  error: undefined,
  nodes: {},
  events: [],
  abortController: null,

  startRun: (input, abortController) =>
    set({
      status: 'running',
      input,
      output: undefined,
      error: undefined,
      nodes: {},
      events: [],
      abortController,
    }),

  applyEvent: (event) =>
    set((s) => {
      const events = [...s.events, event];
      const nodes = { ...s.nodes };

      switch (event.type) {
        case 'node:start':
          nodes[event.nodeId] = {
            ...(nodes[event.nodeId] ?? { status: 'idle', partial: '' }),
            status: 'running',
            partial: '',
            startedAt: event.timestamp,
            error: undefined,
          };
          break;

        case 'node:partial':
          nodes[event.nodeId] = {
            ...(nodes[event.nodeId] ?? { status: 'running', partial: '' }),
            status: 'running',
            partial: (nodes[event.nodeId]?.partial ?? '') + event.text,
          };
          break;

        case 'node:complete':
          nodes[event.nodeId] = {
            ...(nodes[event.nodeId] ?? { status: 'idle', partial: '' }),
            status: 'done',
            output: stringifyForDisplay(event.output),
            finishedAt: event.timestamp,
          };
          break;

        case 'node:error':
          nodes[event.nodeId] = {
            ...(nodes[event.nodeId] ?? { status: 'idle', partial: '' }),
            status: 'error',
            error: event.error,
            finishedAt: event.timestamp,
          };
          break;

        // pipeline:start/complete/error and edge:traverse don't need
        // per-node-state mutations beyond what node events already do.
      }

      return { events, nodes };
    }),

  finishRun: (status, output, error) =>
    set({ status, output, error, abortController: null }),

  resetRun: () =>
    set({
      status: 'idle',
      input: '',
      output: undefined,
      error: undefined,
      nodes: {},
      events: [],
      abortController: null,
    }),

  abort: () => {
    const ctrl = get().abortController;
    if (ctrl) ctrl.abort();
    set({ abortController: null, status: 'idle' });
  },
}));

function stringifyForDisplay(v: unknown): string {
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}
