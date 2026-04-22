'use client';
import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Trash2, Bot, User } from 'lucide-react';
import { usePipelineStore } from '@/store/pipelineStore';
import { TEMPLATES } from '@/lib/templates';

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
    } catch (err) {
      appendToLastMessage('\n\n_Error: Could not connect to API. Make sure ANTHROPIC_API_KEY is set._');
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
