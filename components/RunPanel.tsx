'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import {
  Play,
  Square,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  RotateCcw,
  KeyRound,
} from 'lucide-react';
import { usePipelineStore } from '@/store/pipelineStore';
import { useRunStore } from '@/store/runStore';
import { useSettingsStore } from '@/store/settingsStore';
import { resolveModel } from '@/lib/models';
import type { ExecutionEvent } from '@/lib/executor';

/**
 * Run panel for executing the current pipeline against a user-provided
 * input. Streams events from /api/run via SSE and renders a live event
 * timeline + final output section.
 */
export default function RunPanel({ onClose }: { onClose: () => void }) {
  // Subscribe to scalar slices to avoid the Object.is-equality re-render
  // trap (Zustand v5 returns fresh objects from object-literal selectors).
  const pipelineMeta = usePipelineStore((s) => s.pipeline);
  const nodes = usePipelineStore((s) => s.nodes);
  const edges = usePipelineStore((s) => s.edges);

  const apiKeys = useSettingsStore((s) => s.apiKeys);
  const customOpenRouterModels = useSettingsStore((s) => s.customOpenRouterModels);

  const status = useRunStore((s) => s.status);
  const input = useRunStore((s) => s.input);
  const output = useRunStore((s) => s.output);
  const error = useRunStore((s) => s.error);
  const events = useRunStore((s) => s.events);
  const startRun = useRunStore((s) => s.startRun);
  const applyEvent = useRunStore((s) => s.applyEvent);
  const finishRun = useRunStore((s) => s.finishRun);
  const resetRun = useRunStore((s) => s.resetRun);
  const abort = useRunStore((s) => s.abort);

  const [draftInput, setDraftInput] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [events.length]);

  // Pre-flight: which providers does this pipeline need vs. which keys
  // are configured? We surface a missing-key warning before the user
  // hits Run rather than getting a server error mid-stream.
  const missingProviders = useMemo(() => {
    const needed = new Set<string>();
    for (const n of nodes) {
      const modelId = n.data.agentConfig?.model;
      if (!modelId) continue;
      const m = resolveModel(modelId, customOpenRouterModels);
      if (m) needed.add(m.provider);
    }
    const missing: string[] = [];
    for (const p of needed) {
      if (!apiKeys[p as keyof typeof apiKeys]) missing.push(p);
    }
    return missing;
  }, [nodes, apiKeys, customOpenRouterModels]);

  async function run() {
    const inputText = draftInput.trim();
    if (!inputText || status === 'running') return;

    const fullPipeline = pipelineMeta
      ? { ...pipelineMeta, nodes, edges }
      : null;
    if (!fullPipeline) return;

    const ctrl = new AbortController();
    startRun(inputText, ctrl);

    try {
      const resp = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pipeline: fullPipeline,
          input: inputText,
          apiKeys,
          customOpenRouterModels,
        }),
        signal: ctrl.signal,
      });
      if (!resp.ok || !resp.body) {
        const errBody = await resp.text().catch(() => '');
        finishRun('error', undefined, `HTTP ${resp.status}: ${errBody || 'Request failed'}`);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      let finalOutput: unknown;
      let finalError: string | undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Parse complete SSE messages from the buffer
        const messages = buffer.split('\n\n');
        buffer = messages.pop() ?? '';
        for (const msg of messages) {
          const line = msg.trim();
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') continue;
          try {
            const event = JSON.parse(data) as ExecutionEvent;
            applyEvent(event);
            if (event.type === 'pipeline:complete') finalOutput = event.output;
            if (event.type === 'pipeline:error') finalError = event.error;
          } catch {
            // Ignore non-JSON SSE lines
          }
        }
      }

      if (finalError) {
        finishRun('error', undefined, finalError);
      } else {
        finishRun('complete', finalOutput);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        finishRun('idle');
      } else {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        finishRun('error', undefined, msg);
      }
    }
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 h-14 border-b border-[#e0e2e6]">
        <div className="w-8 h-8 rounded-[10px] bg-[#15803d] flex items-center justify-center shadow-[0_1px_3px_rgba(22,163,74,0.28)]">
          <Play size={14} className="text-white fill-white" strokeWidth={2.2} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-[#181d26] tracking-ui leading-tight">
            Run pipeline
          </p>
          <p className="text-[11px] text-[rgba(4,14,32,0.55)] tracking-ui leading-tight">
            <RunStatusLabel status={status} />
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-[11px] font-medium text-[rgba(4,14,32,0.55)] hover:text-[#181d26] tracking-ui"
        >
          Close
        </button>
      </div>

      {/* Input form */}
      <div className="px-4 pt-4 pb-3 border-b border-[#e0e2e6] space-y-2">
        {/* Pre-flight warning when a pipeline references a model whose
            provider key isn't configured yet. */}
        {status !== 'running' && missingProviders.length > 0 && (
          <div className="flex items-start gap-2 rounded-[10px] bg-[#fef4e6] border border-[#f5d7a0] px-3 py-2">
            <KeyRound size={13} strokeWidth={2.2} className="text-[#b45309] shrink-0 mt-0.5" />
            <p className="text-[11px] text-[#92400e] tracking-ui leading-snug">
              Missing API key for{' '}
              <strong className="font-semibold">{missingProviders.join(', ')}</strong>
              . Open <em>Settings</em> in the toolbar to paste it, or change the model on the affected agent nodes.
            </p>
          </div>
        )}
        <label className="block text-[10px] uppercase tracking-caption text-[rgba(4,14,32,0.55)] font-semibold">
          Input
        </label>
        <textarea
          value={status === 'running' ? input : draftInput}
          onChange={(e) => setDraftInput(e.target.value)}
          disabled={status === 'running'}
          rows={3}
          placeholder="Type the input the pipeline should run on…"
          className="w-full bg-[#f8fafc] border border-[#e0e2e6] rounded-[12px] px-3.5 py-2.5 text-[13px] text-[#181d26] placeholder:text-[rgba(4,14,32,0.38)] tracking-ui focus:border-[#1b61c9] focus:bg-white focus:shadow-[0_0_0_3px_rgba(27,97,201,0.12)] transition-all resize-none disabled:opacity-60"
        />
        <div className="flex gap-2">
          {status === 'running' ? (
            <button
              onClick={abort}
              className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-[12px] bg-[#fdf2f4] border border-[#f1b4c0] text-[#be123c] hover:bg-[#fcdde3] text-[13px] font-semibold tracking-ui transition-colors"
            >
              <Square size={13} className="fill-current" strokeWidth={2.2} />
              Stop
            </button>
          ) : (
            <button
              onClick={run}
              disabled={!draftInput.trim()}
              className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-[12px] bg-[#1b61c9] hover:bg-[#1755b1] disabled:opacity-40 disabled:cursor-not-allowed text-white text-[13px] font-semibold tracking-ui transition-colors shadow-[0_1px_3px_rgba(45,127,249,0.28)]"
            >
              <Play size={13} className="fill-current" strokeWidth={2.2} />
              Run
            </button>
          )}
          {status !== 'idle' && status !== 'running' && (
            <button
              onClick={resetRun}
              className="flex items-center justify-center gap-1.5 h-9 px-3 rounded-[12px] bg-white hover:bg-[#f8fafc] border border-[#e0e2e6] text-[#181d26] text-[13px] font-medium tracking-ui transition-colors"
              title="Reset"
            >
              <RotateCcw size={13} strokeWidth={2.2} />
            </button>
          )}
        </div>
      </div>

      {/* Live event timeline */}
      <div ref={logRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5">
        {events.length === 0 ? (
          <p className="text-[12px] text-[rgba(4,14,32,0.55)] italic tracking-ui leading-relaxed">
            Run events will appear here. Each agent&rsquo;s call, decision branch
            taken, and parallel fan-out gets a line.
          </p>
        ) : (
          events.map((ev, i) => (
            <EventRow key={i} event={ev} baseline={events[0]?.timestamp ?? ev.timestamp} />
          ))
        )}
      </div>

      {/* Output panel */}
      {(status === 'complete' || status === 'error') && (
        <div className="px-4 pb-4 pt-3 border-t border-[#e0e2e6] bg-[#f8fafc]">
          <div className="flex items-center gap-1.5 mb-2">
            {status === 'complete' ? (
              <CheckCircle2 size={13} strokeWidth={2.2} className="text-[#15803d]" />
            ) : (
              <AlertCircle size={13} strokeWidth={2.2} className="text-[#be123c]" />
            )}
            <p className="text-[10px] uppercase tracking-caption font-semibold text-[rgba(4,14,32,0.55)]">
              {status === 'complete' ? 'Final output' : 'Run error'}
            </p>
          </div>
          <div
            className={`max-h-44 overflow-y-auto rounded-[10px] border px-3 py-2 text-[12px] font-mono leading-relaxed whitespace-pre-wrap break-words ${
              status === 'complete'
                ? 'bg-white border-[#e0e2e6] text-[#181d26]'
                : 'bg-[#fdf2f4] border-[#f1b4c0] text-[#be123c]'
            }`}
          >
            {status === 'complete' ? formatOutput(output) : error}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Event row rendering ────────────────────────────────────────────────

function EventRow({ event, baseline }: { event: ExecutionEvent; baseline: number }) {
  const t = relativeTime(event.timestamp, baseline);

  switch (event.type) {
    case 'pipeline:start':
      return (
        <Row icon={<Play size={11} className="text-[#15803d] fill-[#15803d]" />}>
          <span className="text-[#181d26] font-medium">Pipeline started</span>
          <Time t={t} />
        </Row>
      );
    case 'pipeline:complete':
      return (
        <Row icon={<CheckCircle2 size={11} className="text-[#15803d]" />}>
          <span className="text-[#15803d] font-semibold">Pipeline complete</span>
          <Time t={t} />
        </Row>
      );
    case 'pipeline:error':
      return (
        <Row icon={<AlertCircle size={11} className="text-[#be123c]" />}>
          <span className="text-[#be123c] font-semibold">
            Pipeline failed: {event.error}
          </span>
          <Time t={t} />
        </Row>
      );
    case 'node:start':
      return (
        <Row icon={<Loader2 size={11} className="text-[#1b61c9] animate-spin" strokeWidth={2.2} />}>
          <span className="text-[rgba(4,14,32,0.69)]">
            <code className="font-mono text-[11px] text-[#181d26]">{event.nodeId}</code>{' '}
            starting…
          </span>
          <Time t={t} />
        </Row>
      );
    case 'node:complete':
      return (
        <Row icon={<CheckCircle2 size={11} className="text-[#15803d]" />}>
          <span className="text-[rgba(4,14,32,0.69)]">
            <code className="font-mono text-[11px] text-[#181d26]">{event.nodeId}</code>{' '}
            complete
          </span>
          <Time t={t} />
        </Row>
      );
    case 'node:error':
      return (
        <Row icon={<AlertCircle size={11} className="text-[#be123c]" />}>
          <span className="text-[#be123c]">
            <code className="font-mono text-[11px] text-[#be123c]">{event.nodeId}</code>{' '}
            errored: {event.error}
          </span>
          <Time t={t} />
        </Row>
      );
    case 'node:partial':
      // Don't render every chunk in the timeline — too noisy. The canvas
      // node card shows the streaming preview via the runStore.
      return null;
    case 'edge:traverse':
      return (
        <Row icon={<ArrowRight size={11} className="text-[rgba(4,14,32,0.55)]" />}>
          <span className="text-[rgba(4,14,32,0.55)]">
            <code className="font-mono text-[10px]">{event.from}</code> →{' '}
            <code className="font-mono text-[10px]">{event.to}</code>
          </span>
          <Time t={t} />
        </Row>
      );
  }
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-[12px] leading-snug tracking-ui px-1">
      <span className="shrink-0 mt-0.5">{icon}</span>
      <span className="flex-1 min-w-0 flex items-baseline gap-2">{children}</span>
    </div>
  );
}

function Time({ t }: { t: string }) {
  return (
    <span className="ml-auto shrink-0 text-[10px] text-[rgba(4,14,32,0.38)] tracking-caption font-mono tabular-nums">
      {t}
    </span>
  );
}

function RunStatusLabel({ status }: { status: ReturnType<typeof useRunStore.getState>['status'] }) {
  switch (status) {
    case 'idle':
      return <>Idle — type input and press Run</>;
    case 'running':
      return <span className="text-[#1b61c9]">Running…</span>;
    case 'complete':
      return <span className="text-[#15803d]">Complete</span>;
    case 'error':
      return <span className="text-[#be123c]">Error</span>;
  }
}

const formatOutput = (output: unknown): string => {
  if (typeof output === 'string') return output;
  try {
    return JSON.stringify(output, null, 2);
  } catch {
    return String(output);
  }
};

function relativeTime(t: number, baseline: number): string {
  // Time since run start (or panel open if no events yet) — what the user
  // cares about ("how long has this been running?").
  const diff = (t - baseline) / 1000;
  if (diff < 1) return `+${(diff * 1000).toFixed(0)}ms`;
  if (diff < 60) return `+${diff.toFixed(1)}s`;
  const mins = Math.floor(diff / 60);
  const secs = (diff % 60).toFixed(0);
  return `+${mins}m${secs}s`;
}
