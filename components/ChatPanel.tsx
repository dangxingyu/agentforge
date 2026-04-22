'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Sparkles, Trash2, Bot, User, CheckCircle2 } from 'lucide-react';
import { usePipelineStore } from '@/store/pipelineStore';
import { TEMPLATES } from '@/lib/templates';
import type { FormQuestion } from '@/types/pipeline';

const WELCOME = `Hi! I'm AgentForge, your AI pipeline architect.

Describe the agent pipeline you want to build — I'll ask a few clarifying questions and then generate the workflow for you.

**Examples:**
- "Build a pipeline that searches the web, summarizes results, and fact-checks them"
- "Create a code review system with multiple specialized reviewers and a consensus aggregator"
- "Design an essay writer that generates drafts, critiques them, and refines iteratively"

Or pick a template from the toolbar to get started instantly.`;

export default function ChatPanel() {
  const { messages, phase, isStreaming, addMessage, appendToLastMessage, setPhase, setStreaming, clearMessages, loadPipeline } =
    usePipelineStore();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');

    addMessage({ role: 'user', content: text });

    if (phase === 'initial') setPhase('gathering');
    setStreaming(true);

    addMessage({ role: 'assistant', content: '' });

    // After the user's first message in 'gathering' phase, queue design questions
    const showForm = phase === 'initial';

    try {
      const allMsgs = [...usePipelineStore.getState().messages];
      const apiMessages = allMsgs
        .filter((m) => m.content.trim())
        .map((m) => ({ role: m.role, content: m.content }));

      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!resp.ok || !resp.body) throw new Error('Request failed');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });

        // Parse SSE lines
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'text') {
                appendToLastMessage(parsed.text);
                fullText += parsed.text;
              } else if (parsed.type === 'pipeline') {
                // Pipeline spec generated
                loadPipeline(parsed.pipeline);
                setPhase('ready');
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      }
      // After the first user message, show design form questions
      if (showForm) {
        addMessage({
          role: 'assistant',
          content: 'To help me design the best pipeline, tell me a bit more about your preferences:',
          formQuestions: PIPELINE_DESIGN_QUESTIONS,
        });
      }
    } catch (err) {
      appendToLastMessage('\n\n_Error: Could not connect to API. Make sure ANTHROPIC_API_KEY is set._');
      // Still show the form for offline / no-API usage
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
  }

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
    <div className="h-full flex flex-col bg-slate-950">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800">
        <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
          <Sparkles size={14} className="text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-200">Pipeline Designer</p>
          <p className="text-[10px] text-slate-500">Powered by Claude</p>
        </div>
        {messages.length > 0 && (
          <button onClick={clearMessages} className="text-slate-600 hover:text-slate-400 transition-colors" title="Clear chat">
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {displayMessages.map((msg) => (
          <div key={msg.id} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5 ${
              msg.role === 'assistant' ? 'bg-indigo-800' : 'bg-slate-700'
            }`}>
              {msg.role === 'assistant'
                ? <Bot size={12} className="text-indigo-300" />
                : <User size={12} className="text-slate-300" />
              }
            </div>
            <div className={`max-w-[85%] rounded-xl px-3 py-2.5 text-sm leading-relaxed ${
              msg.role === 'assistant'
                ? 'bg-slate-900 text-slate-200 border border-slate-800'
                : 'bg-indigo-600 text-white'
            }`}>
              <MarkdownMessage content={msg.content || (isStreaming ? '▋' : '')} />
              {msg.formQuestions && msg.formQuestions.length > 0 && (
                <FormQuestionCard
                  questions={msg.formQuestions}
                  onSubmit={(answers) => {
                    // Format answers as a readable user message
                    const lines = Object.entries(answers)
                      .filter(([, v]) => (Array.isArray(v) ? v.length > 0 : v))
                      .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : val}`);
                    if (lines.length > 0) {
                      addMessage({ role: 'user', content: `My preferences:\n${lines.join('\n')}` });
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
        <div className="px-3 pb-2">
          <p className="text-[10px] uppercase tracking-wider text-slate-600 font-medium mb-2">Quick templates</p>
          <div className="space-y-1">
            {TEMPLATES.slice(0, 3).map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  usePipelineStore.getState().loadTemplate(t.id);
                  addMessage({ role: 'user', content: `Load the "${t.name}" template` });
                  addMessage({ role: 'assistant', content: `Loaded **${t.name}**. ${t.description} Click any node on the canvas to inspect and edit its configuration.` });
                }}
                className="w-full text-left px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-indigo-700 hover:bg-indigo-950/30 transition-colors"
              >
                <p className="text-xs font-medium text-slate-300">{t.name}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{t.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-3 pb-3 pt-2 border-t border-slate-800">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Describe your pipeline…"
            disabled={isStreaming}
            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-indigo-600 resize-none disabled:opacity-50 max-h-32 overflow-y-auto"
            style={{ minHeight: '42px' }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || isStreaming}
            className="shrink-0 w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
          >
            {isStreaming
              ? <div className="w-3 h-3 rounded-full border border-white border-t-transparent animate-spin" />
              : <Send size={14} className="text-white" />
            }
          </button>
        </div>
        <p className="text-[10px] text-slate-600 mt-1.5 px-1">Enter to send · Shift+Enter for newline</p>
      </div>
    </div>
  );
}

function MarkdownMessage({ content }: { content: string }) {
  const lines = content.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith('**') && line.endsWith('**')) {
          return <p key={i} className="font-semibold text-slate-100">{line.slice(2, -2)}</p>;
        }
        if (line.startsWith('- ') || line.startsWith('• ')) {
          return <p key={i} className="pl-3 before:content-['•'] before:mr-1.5 before:text-indigo-400">{line.slice(2)}</p>;
        }
        // inline bold
        const parts = line.split(/\*\*(.*?)\*\*/g);
        return (
          <p key={i} className="text-sm leading-relaxed">
            {parts.map((part, j) =>
              j % 2 === 1 ? <strong key={j} className="font-semibold text-slate-100">{part}</strong> : part
            )}
          </p>
        );
      })}
    </div>
  );
}

// ── Structured Form Questions ────────────────────────────────────────────────

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
      <div className="flex items-center gap-2 py-1.5 text-xs text-green-400">
        <CheckCircle2 size={13} />
        <span>Preferences submitted</span>
      </div>
    );
  }

  return (
    <div className="space-y-3 mt-2">
      {questions.map((q) => (
        <div key={q.id} className="space-y-1.5">
          <p className="text-[11px] font-medium text-slate-300">{q.label}</p>

          {/* Radio */}
          {q.type === 'radio' && q.options?.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 cursor-pointer group">
              <input
                type="radio"
                name={q.id}
                value={opt.value}
                checked={answers[q.id] === opt.value}
                onChange={() => setAnswer(q.id, opt.value)}
                className="accent-indigo-500 w-3 h-3"
              />
              <span className="text-[11px] text-slate-400 group-hover:text-slate-200 transition-colors">
                {opt.label}
              </span>
            </label>
          ))}

          {/* Checkbox */}
          {q.type === 'checkbox' && q.options?.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                value={opt.value}
                checked={((answers[q.id] as string[]) ?? []).includes(opt.value)}
                onChange={() => toggleCheckbox(q.id, opt.value)}
                className="accent-indigo-500 w-3 h-3 rounded"
              />
              <span className="text-[11px] text-slate-400 group-hover:text-slate-200 transition-colors">
                {opt.label}
              </span>
            </label>
          ))}

          {/* Select */}
          {q.type === 'select' && (
            <select
              value={(answers[q.id] as string) ?? ''}
              onChange={(e) => setAnswer(q.id, e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300 outline-none focus:border-indigo-600"
            >
              <option value="">Select…</option>
              {q.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          )}

          {/* Text input */}
          {q.type === 'text' && (
            <input
              type="text"
              value={(answers[q.id] as string) ?? ''}
              onChange={(e) => setAnswer(q.id, e.target.value)}
              placeholder={q.placeholder}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300 outline-none focus:border-indigo-600"
            />
          )}

          {/* Number input */}
          {q.type === 'number' && (
            <input
              type="number"
              min={q.min}
              max={q.max}
              value={(answers[q.id] as string) ?? ''}
              onChange={(e) => setAnswer(q.id, e.target.value)}
              placeholder={q.placeholder}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300 outline-none focus:border-indigo-600"
            />
          )}
        </div>
      ))}

      <button
        onClick={() => {
          setSubmitted(true);
          onSubmit(answers);
        }}
        className="w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
      >
        Submit preferences
      </button>
    </div>
  );
}
