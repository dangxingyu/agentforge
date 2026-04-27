'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Sparkles, Trash2, Bot, User, CheckCircle2 } from 'lucide-react';
import { usePipelineStore } from '@/store/pipelineStore';
import { useSettingsStore } from '@/store/settingsStore';
import { TEMPLATES } from '@/lib/templates';
import type { FormQuestion } from '@/types/pipeline';

const WELCOME = `Hi! I'm AgentForge, your AI pipeline architect.

Describe the agent pipeline you want to build — I'll ask a few clarifying questions and then generate the workflow for you.

**Examples:**
- "Build a pipeline that searches the web, summarizes results, and fact-checks them"
- "Create a code review system with multiple specialized reviewers and a consensus aggregator"
- "Design an essay writer that generates drafts, critiques them, and refines iteratively"

Or pick a template below to get started instantly.`;

export default function ChatPanel() {
  // Fine-grained subscriptions to avoid the global re-render trap.
  const messages = usePipelineStore((s) => s.messages);
  const phase = usePipelineStore((s) => s.phase);
  const isStreaming = usePipelineStore((s) => s.isStreaming);
  const addMessage = usePipelineStore((s) => s.addMessage);
  const appendToLastMessage = usePipelineStore((s) => s.appendToLastMessage);
  const setPhase = usePipelineStore((s) => s.setPhase);
  const setStreaming = usePipelineStore((s) => s.setStreaming);
  const clearMessages = usePipelineStore((s) => s.clearMessages);
  const loadPipeline = usePipelineStore((s) => s.loadPipeline);
  const anthropicKey = useSettingsStore((s) => s.apiKeys.anthropic);

  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send is a stable callback the form-question card can call to push a
  // synthesized user message and re-trigger the assistant.
  const send = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || isStreaming) return;
    if (overrideText === undefined) setInput('');

    addMessage({ role: 'user', content: text });

    if (phase === 'initial') setPhase('gathering');
    setStreaming(true);

    addMessage({ role: 'assistant', content: '' });

    const showForm = phase === 'initial';

    try {
      const allMsgs = [...usePipelineStore.getState().messages];
      const apiMessages = allMsgs
        .filter((m) => m.content.trim())
        .map((m) => ({ role: m.role, content: m.content }));

      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, apiKey: anthropicKey }),
      });

      if (!resp.ok || !resp.body) throw new Error('Request failed');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      // Buffer-based SSE parsing — events end on `\n\n`, and chunks can
      // slice through the middle of a JSON payload. Splitting on `\n`
      // would silently drop deltas that landed across a chunk boundary.
      let buffer = '';
      let done = false;
      while (!done) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';
        for (const ev of events) {
          const line = ev.trim();
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'text') {
              appendToLastMessage(parsed.text);
            } else if (parsed.type === 'pipeline') {
              loadPipeline(parsed.pipeline);
              setPhase('ready');
            }
          } catch {
            // Ignore non-JSON lines
          }
        }
      }
      if (showForm) {
        addMessage({
          role: 'assistant',
          content: 'To help me design the best pipeline, tell me a bit more about your preferences:',
          formQuestions: PIPELINE_DESIGN_QUESTIONS,
        });
      }
    } catch {
      appendToLastMessage('\n\n_Error: Could not connect to API. Make sure ANTHROPIC_API_KEY is set._');
      if (showForm) {
        addMessage({
          role: 'assistant',
          content: 'While the API connects, you can fill out these design preferences:',
          formQuestions: PIPELINE_DESIGN_QUESTIONS,
        });
      }
    } finally {
      setStreaming(false);
    }
  }, [
    input,
    isStreaming,
    phase,
    addMessage,
    appendToLastMessage,
    setPhase,
    setStreaming,
    loadPipeline,
    anthropicKey,
  ]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const displayMessages = messages.length === 0
    ? [{ id: 'welcome', role: 'assistant' as const, content: WELCOME, timestamp: '' }]
    : messages;

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 h-14 border-b border-[#e0e2e6]">
        <div className="w-8 h-8 rounded-[10px] bg-[#1b61c9] flex items-center justify-center shadow-[0_1px_3px_rgba(45,127,249,0.28)]">
          <Sparkles size={15} className="text-white" strokeWidth={2.2} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-[#181d26] tracking-ui leading-tight">
            Pipeline Designer
          </p>
          <p className="text-[11px] text-[rgba(4,14,32,0.55)] tracking-ui leading-tight">
            Powered by Claude
          </p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearMessages}
            className="w-7 h-7 rounded-[8px] flex items-center justify-center text-[rgba(4,14,32,0.55)] hover:text-[#181d26] hover:bg-[#f1f4f8] transition-colors"
            title="Clear chat"
          >
            <Trash2 size={14} strokeWidth={2} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {displayMessages.map((msg) => (
          <div key={msg.id} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div
              className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5 ${
                msg.role === 'assistant'
                  ? 'bg-[#eef3fb] border border-[#dbe7f7]'
                  : 'bg-[#1b61c9]'
              }`}
            >
              {msg.role === 'assistant'
                ? <Bot size={13} className="text-[#1b61c9]" strokeWidth={2.2} />
                : <User size={13} className="text-white" strokeWidth={2.2} />
              }
            </div>
            <div
              className={`max-w-[85%] rounded-[14px] px-3.5 py-2.5 text-[13px] leading-relaxed tracking-ui ${
                msg.role === 'assistant'
                  ? 'bg-[#f8fafc] text-[#181d26] border border-[#e0e2e6]'
                  : 'bg-[#1b61c9] text-white'
              }`}
            >
              <MarkdownMessage
                content={msg.content || (isStreaming ? '▋' : '')}
                isUser={msg.role === 'user'}
              />
              {msg.formQuestions && msg.formQuestions.length > 0 && (
                <FormQuestionCard
                  questions={msg.formQuestions}
                  onSubmit={(answers) => {
                    // Synthesize a preferences message and feed it back to
                    // Claude so the conversation actually advances. Without
                    // this, clicking Submit was a dead-end (audit P1).
                    const lines = Object.entries(answers)
                      .filter(([, v]) => (Array.isArray(v) ? v.length > 0 : v))
                      .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : val}`);
                    if (lines.length > 0) {
                      send(`My preferences:\n${lines.join('\n')}`);
                    }
                  }}
                />
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Quick templates */}
      {messages.length === 0 && (
        <div className="px-4 pb-3">
          <p className="text-[10px] uppercase tracking-caption text-[rgba(4,14,32,0.55)] font-semibold mb-2 px-1">
            Quick templates
          </p>
          <div className="space-y-1.5">
            {TEMPLATES.slice(0, 3).map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  usePipelineStore.getState().loadTemplate(t.id);
                  addMessage({ role: 'user', content: `Load the "${t.name}" template` });
                  addMessage({
                    role: 'assistant',
                    content: `Loaded **${t.name}**. ${t.description} Click any node on the canvas to inspect and edit its configuration.`,
                  });
                }}
                className="w-full text-left px-3.5 py-2.5 rounded-[12px] bg-white border border-[#e0e2e6] hover:border-[#1b61c9] hover:bg-[#eef3fb] transition-colors group"
              >
                <p className="text-[12px] font-semibold text-[#181d26] tracking-ui group-hover:text-[#1b61c9]">
                  {t.name}
                </p>
                <p className="text-[11px] text-[rgba(4,14,32,0.55)] mt-0.5 leading-relaxed">
                  {t.description}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-4 pt-3 border-t border-[#e0e2e6] bg-white">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Describe your pipeline…"
            disabled={isStreaming}
            className="flex-1 bg-[#f8fafc] border border-[#e0e2e6] rounded-[12px] px-3.5 py-2.5 text-[13px] text-[#181d26] placeholder:text-[rgba(4,14,32,0.38)] tracking-ui focus:border-[#1b61c9] focus:bg-white focus:shadow-[0_0_0_3px_rgba(27,97,201,0.12)] transition-all resize-none disabled:opacity-60 max-h-32 overflow-y-auto"
            style={{ minHeight: '42px' }}
          />
          <button
            type="button"
            onClick={() => send()}
            disabled={!input.trim() || isStreaming}
            className="shrink-0 w-10 h-10 rounded-[12px] bg-[#1b61c9] hover:bg-[#1755b1] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors shadow-[0_1px_3px_rgba(45,127,249,0.28)]"
          >
            {isStreaming ? (
              <div className="w-3.5 h-3.5 rounded-full border-[1.5px] border-white border-t-transparent animate-spin" />
            ) : (
              <Send size={15} className="text-white" strokeWidth={2.2} />
            )}
          </button>
        </div>
        <p className="text-[10px] text-[rgba(4,14,32,0.38)] mt-1.5 px-1 tracking-ui">
          Enter to send · Shift+Enter for newline
        </p>
      </div>
    </div>
  );
}

function MarkdownMessage({ content, isUser }: { content: string; isUser: boolean }) {
  const lines = content.split('\n');
  const boldClass = isUser ? 'text-white' : 'text-[#181d26]';
  const bulletClass = isUser ? 'before:text-white/80' : 'before:text-[#1b61c9]';

  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith('**') && line.endsWith('**')) {
          return (
            <p key={i} className={`font-semibold ${boldClass}`}>
              {line.slice(2, -2)}
            </p>
          );
        }
        if (line.startsWith('- ') || line.startsWith('• ')) {
          return (
            <p key={i} className={`pl-4 before:content-['•'] before:mr-1.5 before:font-bold ${bulletClass}`}>
              {line.slice(2)}
            </p>
          );
        }
        const parts = line.split(/\*\*(.*?)\*\*/g);
        return (
          <p key={i} className="leading-relaxed">
            {parts.map((part, j) =>
              j % 2 === 1 ? (
                <strong key={j} className={`font-semibold ${boldClass}`}>
                  {part}
                </strong>
              ) : (
                part
              )
            )}
          </p>
        );
      })}
    </div>
  );
}

/* ── Form questions ──────────────────────────────────────────────────────── */

const PIPELINE_DESIGN_QUESTIONS: FormQuestion[] = [
  {
    id: 'pattern',
    type: 'radio',
    label: 'What pipeline pattern fits best?',
    options: [
      { label: 'Generate → Critique → Refine (iterative quality loop)', value: 'gcr' },
      { label: 'Map-Reduce (split, process chunks, merge)', value: 'map-reduce' },
      { label: 'Parallel Solve → Distill (N attempts, pick best)', value: 'parallel-distill' },
      { label: 'Divide & Conquer (decompose, solve sub-problems)', value: 'divide-conquer' },
      { label: 'Custom / not sure', value: 'custom' },
    ],
  },
  {
    id: 'parallelism',
    type: 'select',
    label: 'How many parallel agents?',
    options: [
      { label: '2 (fast, low cost)', value: '2' },
      { label: '3-4 (balanced)', value: '4' },
      { label: '5-8 (thorough)', value: '8' },
      { label: '8+ (exhaustive)', value: '12' },
    ],
  },
  {
    id: 'model',
    type: 'radio',
    label: 'Primary model tier?',
    options: [
      { label: 'Sonnet (fast & capable)', value: 'claude-sonnet-4-6' },
      { label: 'Opus (maximum quality)', value: 'claude-opus-4-7' },
      { label: 'Haiku (fastest, cost-efficient)', value: 'claude-haiku-4-5-20251001' },
      { label: 'Mixed (different models per role)', value: 'mixed' },
    ],
  },
  {
    id: 'human_review',
    type: 'checkbox',
    label: 'Include these optional features?',
    options: [
      { label: 'Human-in-the-loop review step', value: 'human' },
      { label: 'External tool/API calls', value: 'tools' },
      { label: 'Quality gate with retry loop', value: 'quality-gate' },
    ],
  },
];

function FormQuestionCard({
  questions,
  onSubmit,
}: {
  questions: FormQuestion[];
  onSubmit: (answers: Record<string, string | string[]>) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [submitted, setSubmitted] = useState(false);

  const setAnswer = useCallback((id: string, value: string | string[]) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }, []);

  const toggleCheckbox = useCallback((id: string, value: string) => {
    setAnswers((prev) => {
      const current = (prev[id] as string[]) ?? [];
      return {
        ...prev,
        [id]: current.includes(value)
          ? current.filter((v) => v !== value)
          : [...current, value],
      };
    });
  }, []);

  if (submitted) {
    return (
      <div className="flex items-center gap-2 py-2 text-[12px] text-[#006400] tracking-ui font-medium">
        <CheckCircle2 size={14} strokeWidth={2.2} />
        <span>Preferences submitted</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-3">
      {questions.map((q) => (
        <div key={q.id} className="space-y-2">
          <p className="text-[11px] font-semibold text-[#181d26] tracking-ui">{q.label}</p>

          {q.type === 'radio' && (
            <div className="space-y-1">
              {q.options?.map((opt) => {
                const checked = answers[q.id] === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-2 px-2.5 py-1.5 rounded-[10px] cursor-pointer border transition-colors ${
                      checked
                        ? 'bg-[#eef3fb] border-[#1b61c9]'
                        : 'bg-white border-[#e0e2e6] hover:bg-[#f8fafc] hover:border-[#cbd0d7]'
                    }`}
                  >
                    <input
                      type="radio"
                      name={q.id}
                      value={opt.value}
                      checked={checked}
                      onChange={() => setAnswer(q.id, opt.value)}
                      className="accent-[#1b61c9] w-3.5 h-3.5 mt-0.5 shrink-0"
                    />
                    <span
                      className={`text-[11px] leading-snug tracking-ui ${
                        checked ? 'text-[#181d26] font-medium' : 'text-[rgba(4,14,32,0.69)]'
                      }`}
                    >
                      {opt.label}
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          {q.type === 'checkbox' && (
            <div className="space-y-1">
              {q.options?.map((opt) => {
                const checked = ((answers[q.id] as string[]) ?? []).includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-2 px-2.5 py-1.5 rounded-[10px] cursor-pointer border transition-colors ${
                      checked
                        ? 'bg-[#eef3fb] border-[#1b61c9]'
                        : 'bg-white border-[#e0e2e6] hover:bg-[#f8fafc] hover:border-[#cbd0d7]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      value={opt.value}
                      checked={checked}
                      onChange={() => toggleCheckbox(q.id, opt.value)}
                      className="accent-[#1b61c9] w-3.5 h-3.5 mt-0.5 shrink-0 rounded"
                    />
                    <span
                      className={`text-[11px] leading-snug tracking-ui ${
                        checked ? 'text-[#181d26] font-medium' : 'text-[rgba(4,14,32,0.69)]'
                      }`}
                    >
                      {opt.label}
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          {q.type === 'select' && (
            <select
              value={(answers[q.id] as string) ?? ''}
              onChange={(e) => setAnswer(q.id, e.target.value)}
              className="w-full bg-white border border-[#e0e2e6] rounded-[10px] px-3 py-2 text-[12px] text-[#181d26] tracking-ui focus:border-[#1b61c9] focus:shadow-[0_0_0_3px_rgba(27,97,201,0.12)] transition-all"
            >
              <option value="">Select…</option>
              {q.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}

          {q.type === 'text' && (
            <input
              type="text"
              value={(answers[q.id] as string) ?? ''}
              onChange={(e) => setAnswer(q.id, e.target.value)}
              placeholder={q.placeholder}
              className="w-full bg-white border border-[#e0e2e6] rounded-[10px] px-3 py-2 text-[12px] text-[#181d26] placeholder:text-[rgba(4,14,32,0.38)] tracking-ui focus:border-[#1b61c9] focus:shadow-[0_0_0_3px_rgba(27,97,201,0.12)] transition-all"
            />
          )}

          {q.type === 'number' && (
            <input
              type="number"
              min={q.min}
              max={q.max}
              value={(answers[q.id] as string) ?? ''}
              onChange={(e) => setAnswer(q.id, e.target.value)}
              placeholder={q.placeholder}
              className="w-full bg-white border border-[#e0e2e6] rounded-[10px] px-3 py-2 text-[12px] text-[#181d26] placeholder:text-[rgba(4,14,32,0.38)] tracking-ui focus:border-[#1b61c9] focus:shadow-[0_0_0_3px_rgba(27,97,201,0.12)] transition-all"
            />
          )}
        </div>
      ))}

      <button
        onClick={() => {
          setSubmitted(true);
          onSubmit(answers);
        }}
        className="w-full py-2 rounded-[12px] bg-[#1b61c9] hover:bg-[#1755b1] text-white text-[12px] font-semibold tracking-ui transition-colors shadow-[0_1px_3px_rgba(45,127,249,0.28)]"
      >
        Submit preferences
      </button>
    </div>
  );
}
