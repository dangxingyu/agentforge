'use client';
import type { UpstreamField } from '@/lib/pipeline';

interface Props {
  expression: string;
  upstream: UpstreamField[];
  /** Tailwind class for the non-token text color. */
  accentText?: string;
}

const TOKEN_RE = /\{\{\s*([\w-]+)\s*\.\s*([\w-]+)\s*\}\}/g;

/**
 * Render a condition expression with `{{role.field}}` tokens highlighted.
 * Resolved refs are shown in the brand blue; unresolved ones in red with
 * a dashed underline so the problem is visible on the canvas at a glance.
 */
export default function ConditionTokens({
  expression,
  upstream,
  accentText = 'text-[#181d26]',
}: Props) {
  if (!expression) {
    return (
      <code className={`text-[11px] font-mono italic ${accentText} opacity-60`}>
        (no condition)
      </code>
    );
  }

  const available = new Set(
    upstream.map((u) => `${u.role}.${u.field.name}`)
  );

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(TOKEN_RE);
  let key = 0;
  while ((m = re.exec(expression)) !== null) {
    if (m.index > lastIndex) {
      parts.push(
        <span key={`t-${key++}`}>{expression.slice(lastIndex, m.index)}</span>
      );
    }
    const role = m[1];
    const field = m[2];
    const ok = available.has(`${role}.${field}`);
    parts.push(
      <span
        key={`ref-${key++}`}
        className={`inline-flex items-center rounded-[5px] px-1 py-[1px] text-[10.5px] font-semibold border ${
          ok
            ? 'bg-[#eef3fb] border-[#bcd0ee] text-[#1b61c9]'
            : 'bg-[#fdf2f4] border-[#f1b4c0] text-[#be123c] underline decoration-dashed decoration-[#be123c] underline-offset-2'
        }`}
        title={ok ? `${role}.${field}` : `Unresolved: ${role}.${field}`}
      >
        {role}.{field}
      </span>
    );
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < expression.length) {
    parts.push(
      <span key={`t-${key++}`}>{expression.slice(lastIndex)}</span>
    );
  }

  return (
    <code className={`text-[11px] font-mono leading-snug ${accentText} break-words`}>
      {parts}
    </code>
  );
}
