'use client';
import { useRef, useMemo } from 'react';
import { AlertTriangle, Sparkles, AlertCircle } from 'lucide-react';
import type { UpstreamField } from '@/lib/pipeline';
import { validateExpression } from '@/lib/expression';

interface Props {
  value: string;
  onChange: (value: string) => void;
  upstream: UpstreamField[];
  placeholder?: string;
  /** Accent color hex used by the focus ring — matches the node's theme. */
  accent?: string;
  /** When true, only a single `{{role.field}}` token is expected
   * (used for aggregator selectionCriteria). */
  singleRefMode?: boolean;
}

/**
 * Condition editor with insertable upstream variable chips. Parses the
 * current expression, surfaces both syntax errors and unresolved-ref
 * errors, and lets the user click a chip to insert a `{{role.field}}`
 * token at the cursor position.
 */
export default function ConditionEditor({
  value,
  onChange,
  upstream,
  placeholder,
  accent = '#1b61c9',
  singleRefMode = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const availableSet = useMemo(() => {
    const set = new Set<string>();
    for (const u of upstream) set.add(`${u.role}.${u.field.name}`);
    return set;
  }, [upstream]);

  const validation = useMemo(
    () => validateExpression(value, availableSet),
    [value, availableSet]
  );

  // Group upstream fields by role for the picker
  const grouped = useMemo(() => {
    const map = new Map<string, UpstreamField[]>();
    for (const u of upstream) {
      if (!map.has(u.role)) map.set(u.role, []);
      map.get(u.role)!.push(u);
    }
    return Array.from(map.entries());
  }, [upstream]);

  function insertAtCursor(token: string) {
    const el = inputRef.current;
    if (!el) {
      onChange(value + token);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    // In single-ref mode, replace the entire value
    const next = singleRefMode
      ? token
      : value.slice(0, start) + token + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = singleRefMode ? token.length : start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  const hasSyntaxErrors = validation.syntaxErrors.length > 0;
  const hasUnresolvedRefs = validation.unresolvedRefs.length > 0;

  return (
    <div>
      <div
        className="relative rounded-[10px] border bg-white transition-all focus-within:shadow-[0_0_0_3px_rgba(27,97,201,0.12)]"
        style={
          {
            '--ce-accent': accent,
            borderColor: hasSyntaxErrors ? '#be123c' : '#e0e2e6',
          } as React.CSSProperties
        }
      >
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? 'e.g. {{grader.score}} >= 0.8'}
          className="w-full bg-transparent px-3 py-2 text-[13px] font-mono text-[#181d26] placeholder:text-[rgba(4,14,32,0.38)] outline-none tracking-ui"
          spellCheck={false}
        />
      </div>

      {/* Live ref preview */}
      {validation.refs.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {validation.refs.map((r, i) => {
            const ok = availableSet.has(`${r.role}.${r.field}`);
            return (
              <span
                key={i}
                className={`inline-flex items-center gap-1 rounded-[6px] border px-1.5 py-0.5 text-[10px] font-mono font-semibold tracking-caption ${
                  ok
                    ? 'bg-[#eef3fb] border-[#bcd0ee] text-[#1b61c9]'
                    : 'bg-[#fdf2f4] border-[#f1b4c0] text-[#be123c]'
                }`}
                title={
                  ok
                    ? `Resolves to ${r.role}.${r.field}`
                    : `No upstream agent declares ${r.role}.${r.field}`
                }
              >
                {!ok && <AlertTriangle size={10} strokeWidth={2.5} />}
                {r.raw}
              </span>
            );
          })}
        </div>
      )}

      {/* Syntax errors */}
      {hasSyntaxErrors && (
        <div className="mt-2 rounded-[8px] bg-[#fdf2f4] border border-[#f1b4c0] px-2.5 py-1.5">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#be123c] tracking-ui">
            <AlertCircle size={12} strokeWidth={2.5} />
            Syntax error
          </p>
          <ul className="mt-1 space-y-0.5 pl-5 list-disc list-outside">
            {validation.syntaxErrors.map((e, i) => (
              <li
                key={i}
                className="text-[11px] text-[#be123c] tracking-ui leading-snug"
              >
                <span className="font-mono">@{e.pos}</span> {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Unresolved-ref banner */}
      {hasUnresolvedRefs && (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] text-[#be123c] tracking-ui leading-snug">
          <AlertTriangle size={12} strokeWidth={2.5} className="mt-0.5 shrink-0" />
          <span>
            <strong>{validation.unresolvedRefs.length}</strong> reference
            {validation.unresolvedRefs.length > 1 ? 's' : ''} can&rsquo;t be resolved.
            Either declare the field on an upstream agent&rsquo;s output schema, or
            remove the reference.
          </span>
        </p>
      )}

      {/* Upstream field picker */}
      <div className="mt-3">
        <p className="text-[10px] uppercase tracking-caption text-[rgba(4,14,32,0.55)] font-semibold mb-1.5 flex items-center gap-1.5">
          <Sparkles size={11} strokeWidth={2.2} className="text-[#1b61c9]" />
          {singleRefMode ? 'Pick a field' : 'Available upstream variables'}
        </p>
        {grouped.length === 0 ? (
          <p className="text-[11px] text-[rgba(4,14,32,0.55)] italic tracking-ui px-2 py-1.5 rounded-[8px] bg-[#f8fafc] border border-dashed border-[#e0e2e6]">
            No upstream agent has declared an output schema. Add fields on an
            agent node&rsquo;s <em>Output schema</em> section and they&rsquo;ll show up
            here.
          </p>
        ) : (
          <div className="space-y-2">
            {grouped.map(([role, fields]) => (
              <div key={role}>
                <p className="text-[10px] font-mono text-[rgba(4,14,32,0.69)] mb-1 tracking-caption">
                  {role}
                  <span className="text-[rgba(4,14,32,0.38)] ml-1.5 font-sans">
                    — {fields[0].sourceLabel}
                  </span>
                </p>
                <div className="flex flex-wrap gap-1">
                  {fields.map((u) => (
                    <button
                      key={`${u.role}.${u.field.name}`}
                      onClick={() => insertAtCursor(`{{${u.role}.${u.field.name}}}`)}
                      title={u.field.description ?? `${u.role}.${u.field.name}`}
                      className="group inline-flex items-center gap-1 rounded-[6px] border border-[#e0e2e6] bg-white hover:border-[#1b61c9] hover:bg-[#eef3fb] px-1.5 py-0.5 text-[10px] font-mono font-medium tracking-caption text-[#181d26] hover:text-[#1b61c9] transition-colors"
                    >
                      <span className="text-[rgba(4,14,32,0.55)] group-hover:text-[#1b61c9]">
                        {u.role}.
                      </span>
                      <span>{u.field.name}</span>
                      <span className="text-[rgba(4,14,32,0.38)] group-hover:text-[#1b61c9] italic font-sans ml-0.5">
                        {u.field.type}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
