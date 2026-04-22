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
    el.style.height = Math.min(el.scrollHeight, 360) + 'px';
  }, []);

  useEffect(() => {
    resize();
  }, [value, resize]);

  return (
    <div className="relative rounded-[12px] overflow-hidden border border-[#e0e2e6] bg-white focus-within:border-[#1b61c9] focus-within:shadow-[0_0_0_3px_rgba(27,97,201,0.12)] transition-all">
      <div className="flex items-center justify-between px-3 py-2 bg-[#f8fafc] border-b border-[#e0e2e6]">
        <span className="text-[10px] uppercase tracking-caption text-[rgba(4,14,32,0.55)] font-semibold">
          System prompt
        </span>
        <span className="text-[10px] text-[rgba(4,14,32,0.55)] tracking-caption font-medium tabular-nums">
          {value.length.toLocaleString()} chars
        </span>
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          resize();
        }}
        onInput={resize}
        className="w-full min-h-[140px] bg-white px-3.5 py-3 text-[12px] text-[#181d26] font-mono leading-relaxed outline-none resize-none placeholder:text-[rgba(4,14,32,0.38)]"
        placeholder="You are a helpful assistant..."
        spellCheck={false}
      />
    </div>
  );
}
