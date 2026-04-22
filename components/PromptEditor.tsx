'use client';
import { useRef, useEffect, useCallback } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export default function PromptEditor({ value, onChange }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 320) + 'px';
  }, []);

  useEffect(() => {
    resize();
  }, [value, resize]);

  return (
    <div className="relative rounded-lg overflow-hidden border border-slate-700 focus-within:border-indigo-600 transition-colors">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800/80 border-b border-slate-700">
        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">System Prompt</span>
        <span className="text-[10px] text-slate-600">{value.length} chars</span>
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => { onChange(e.target.value); resize(); }}
        onInput={resize}
        className="w-full min-h-[120px] bg-slate-900 px-3 py-2.5 text-[12px] text-slate-300 font-mono leading-relaxed outline-none resize-none"
        placeholder="You are a helpful assistant..."
        spellCheck={false}
      />
    </div>
  );
}
