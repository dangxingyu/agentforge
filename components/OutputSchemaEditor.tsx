'use client';
import { Plus, X, ChevronDown } from 'lucide-react';
import type { OutputField, OutputFieldType } from '@/types/pipeline';

const TYPES: OutputFieldType[] = ['number', 'string', 'boolean', 'enum', 'array', 'object'];

const TYPE_COLOR: Record<OutputFieldType, string> = {
  number: 'text-[#1b61c9] bg-[#eef3fb] border-[#bcd0ee]',
  string: 'text-[#15803d] bg-[#e7f6ee] border-[#a8d9bd]',
  boolean: 'text-[#c2410c] bg-[#fdebdd] border-[#f1bd92]',
  enum: 'text-[#6d28d9] bg-[#f0eafb] border-[#c8b4ec]',
  array: 'text-[#0e7490] bg-[#e3f4f7] border-[#a3d1dc]',
  object: 'text-[#475569] bg-[#f1f4f8] border-[#d1d5db]',
};

interface Props {
  value: OutputField[];
  onChange: (value: OutputField[]) => void;
}

/**
 * Editor for an LLM agent's declared output schema. Fields declared here
 * become `{{role.field}}` references available to downstream decision/loop
 * condition editors.
 */
export default function OutputSchemaEditor({ value, onChange }: Props) {
  function update(idx: number, patch: Partial<OutputField>) {
    const next = value.slice();
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  }
  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }
  function add() {
    onChange([
      ...value,
      { name: `field_${value.length + 1}`, type: 'string' },
    ]);
  }

  return (
    <div className="space-y-2">
      {value.length === 0 ? (
        <p className="text-[11px] text-[rgba(4,14,32,0.55)] italic tracking-ui px-2 py-2 rounded-[8px] bg-[#f8fafc] border border-dashed border-[#e0e2e6]">
          No output fields declared. Add fields that this agent returns (e.g.
          <span className="font-mono not-italic"> score</span>,
          <span className="font-mono not-italic"> verdict</span>) so downstream
          decisions can reference them as <span className="font-mono not-italic">{'{{'}role.field{'}}'}</span>.
        </p>
      ) : (
        <div className="space-y-1.5">
          {value.map((f, i) => (
            <FieldRow
              key={i}
              field={f}
              onChange={(patch) => update(i, patch)}
              onRemove={() => remove(i)}
            />
          ))}
        </div>
      )}

      <button
        onClick={add}
        className="w-full flex items-center justify-center gap-1.5 h-8 rounded-[10px] border border-dashed border-[#cbd0d7] bg-[#f8fafc] text-[12px] font-medium text-[rgba(4,14,32,0.69)] tracking-ui hover:border-[#1b61c9] hover:text-[#1b61c9] hover:bg-[#eef3fb] transition-colors"
      >
        <Plus size={13} strokeWidth={2.2} />
        Add output field
      </button>
    </div>
  );
}

function FieldRow({
  field,
  onChange,
  onRemove,
}: {
  field: OutputField;
  onChange: (patch: Partial<OutputField>) => void;
  onRemove: () => void;
}) {
  const typeClass = TYPE_COLOR[field.type] ?? TYPE_COLOR.string;

  return (
    <div className="rounded-[10px] border border-[#e0e2e6] bg-white overflow-hidden focus-within:border-[#1b61c9] focus-within:shadow-[0_0_0_3px_rgba(27,97,201,0.08)] transition-all">
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <input
          value={field.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="field_name"
          className="flex-1 bg-transparent text-[12px] font-mono font-medium text-[#181d26] placeholder:text-[rgba(4,14,32,0.38)] outline-none tracking-ui min-w-0"
          spellCheck={false}
        />

        <div className="relative shrink-0">
          <select
            value={field.type}
            onChange={(e) => onChange({ type: e.target.value as OutputFieldType })}
            className={`appearance-none text-[10px] font-mono font-semibold tracking-caption border rounded-[6px] pl-2 pr-6 py-1 cursor-pointer ${typeClass}`}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <ChevronDown
            size={10}
            strokeWidth={2.5}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60"
          />
        </div>

        <button
          onClick={onRemove}
          className="w-6 h-6 rounded-[6px] flex items-center justify-center text-[rgba(4,14,32,0.38)] hover:text-[#be123c] hover:bg-[#fdf2f4] transition-colors shrink-0"
          title="Remove field"
        >
          <X size={12} strokeWidth={2.2} />
        </button>
      </div>

      <input
        value={field.description ?? ''}
        onChange={(e) => onChange({ description: e.target.value })}
        placeholder="Description (optional)"
        className="w-full bg-[#f8fafc] border-t border-[#e0e2e6] px-2.5 py-1.5 text-[11px] text-[rgba(4,14,32,0.69)] placeholder:text-[rgba(4,14,32,0.38)] outline-none tracking-ui"
      />
    </div>
  );
}
