'use client';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { EditorView } from '@codemirror/view';
import { useMemo } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export default function PromptEditor({ value, onChange }: Props) {
  // Memoize extensions so CodeMirror doesn't re-create the editor on every
  // parent render (otherwise focus/cursor are lost on each keystroke).
  const extensions = useMemo(
    () => [
      markdown(),
      EditorView.lineWrapping,
      EditorView.theme({
        '&': {
          backgroundColor: '#ffffff',
          fontSize: '12px',
          lineHeight: '1.55',
        },
        '.cm-content': {
          fontFamily:
            'ui-monospace, "SF Mono", Menlo, Monaco, Consolas, monospace',
          color: '#181d26',
          padding: '12px 14px',
          caretColor: '#1b61c9',
        },
        '.cm-cursor, .cm-dropCursor': {
          borderLeftColor: '#1b61c9',
          borderLeftWidth: '1.5px',
        },
        '&.cm-focused': { outline: 'none' },
        '.cm-selectionBackground': {
          backgroundColor: '#dbe7f7 !important',
        },
        '.cm-activeLine': { backgroundColor: 'transparent' },
        '.cm-line': { padding: '0' },
        // Markdown token coloring tuned for the Airtable-blue palette
        '.tok-heading': { color: '#1b61c9', fontWeight: '600' },
        '.tok-emphasis': { fontStyle: 'italic' },
        '.tok-strong': { color: '#181d26', fontWeight: '600' },
        '.tok-link': { color: '#1b61c9' },
        '.tok-monospace': {
          color: '#15803d',
          backgroundColor: '#f1f4f8',
          padding: '0 2px',
          borderRadius: '3px',
        },
      }),
    ],
    []
  );

  return (
    <div className="rounded-[12px] overflow-hidden border border-[#e0e2e6] bg-white focus-within:border-[#1b61c9] focus-within:shadow-[0_0_0_3px_rgba(27,97,201,0.12)] transition-all">
      <div className="flex items-center justify-between px-3 py-2 bg-[#f8fafc] border-b border-[#e0e2e6]">
        <span className="text-[10px] uppercase tracking-caption text-[rgba(4,14,32,0.55)] font-semibold">
          System prompt · Markdown
        </span>
        <span className="text-[10px] text-[rgba(4,14,32,0.55)] tracking-caption font-medium tabular-nums">
          {value.length.toLocaleString()} chars
        </span>
      </div>
      <CodeMirror
        value={value}
        onChange={onChange}
        extensions={extensions}
        basicSetup={{
          lineNumbers: false,
          foldGutter: false,
          highlightActiveLine: false,
          highlightActiveLineGutter: false,
          autocompletion: false,
          searchKeymap: false,
        }}
        minHeight="140px"
        maxHeight="380px"
        placeholder="You are a helpful assistant…"
      />
    </div>
  );
}
