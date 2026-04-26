'use client';
import { useState, useEffect } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { usePipelineStore } from '@/store/pipelineStore';
import type { NodeData, ModelId, LLMAgentConfig, DecisionConfig, LoopConfig, ParallelConfig, AggregatorConfig, HumanConfig, ToolConfig, OutputField } from '@/types/pipeline';
import { MODEL_LABELS } from '@/types/pipeline';
import { collectUpstreamSchemas } from '@/lib/pipeline';
import PromptEditor from './PromptEditor';
import OutputSchemaEditor from './OutputSchemaEditor';
import ConditionEditor from './ConditionEditor';

const MODELS = Object.entries(MODEL_LABELS) as [ModelId, string][];

// Kind → tint + border + text (light theme)
const KIND_STYLE: Record<
  string,
  { bg: string; border: string; text: string; dot: string }
> = {
  llm_agent: { bg: '#eef3fb', border: '#bcd0ee', text: '#1b61c9', dot: '#1b61c9' },
  decision:  { bg: '#fef4e6', border: '#f5d7a0', text: '#b45309', dot: '#d97706' },
  parallel:  { bg: '#e7f6ee', border: '#a8d9bd', text: '#15803d', dot: '#16a34a' },
  aggregator:{ bg: '#e3f4f7', border: '#a3d1dc', text: '#0e7490', dot: '#0891b2' },
  loop:      { bg: '#f0eafb', border: '#c8b4ec', text: '#6d28d9', dot: '#7c3aed' },
  human:     { bg: '#fbe7ec', border: '#f1b4c0', text: '#be123c', dot: '#e11d48' },
  tool:      { bg: '#fdebdd', border: '#f1bd92', text: '#c2410c', dot: '#ea580c' },
  input:     { bg: '#f1f4f8', border: '#d1d5db', text: '#475569', dot: '#64748b' },
  output:    { bg: '#ece6f8', border: '#c5b4e8', text: '#6d28d9', dot: '#7c3aed' },
};

export default function NodeDetail() {
  const { nodes, edges, selectedNodeId, selectNode, updateNodeData } = usePipelineStore();
  const node = nodes.find((n) => n.id === selectedNodeId);
  const [draft, setDraft] = useState<NodeData | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (node) setDraft(JSON.parse(JSON.stringify(node.data)));
  }, [selectedNodeId]);

  // Variables available to this node's condition editor.
  // Decision nodes evaluate over data flowing INTO them, so they only see
  // upstream agents. Loop nodes evaluate at the end of each iteration over
  // agents that ran inside the loop body, which we approximate as the union
  // of upstream and downstream reachable agents.
  const direction =
    node?.type === 'loop' ? ('loop-body' as const) : ('upstream' as const);
  const upstream = selectedNodeId
    ? collectUpstreamSchemas(selectedNodeId, nodes, edges, direction)
    : [];

  if (!node || !draft) return null;

  function save() {
    if (!draft || !selectedNodeId) return;
    updateNodeData(selectedNodeId, draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function setAgent(patch: Partial<LLMAgentConfig>) {
    setDraft((d) => d ? { ...d, agentConfig: { ...d.agentConfig!, ...patch } } : d);
  }
  function setDecision(patch: Partial<DecisionConfig>) {
    setDraft((d) => d ? { ...d, decisionConfig: { ...d.decisionConfig!, ...patch } } : d);
  }
  function setLoop(patch: Partial<LoopConfig>) {
    setDraft((d) => d ? { ...d, loopConfig: { ...d.loopConfig!, ...patch } } : d);
  }
  function setParallel(patch: Partial<ParallelConfig>) {
    setDraft((d) => d ? { ...d, parallelConfig: { ...d.parallelConfig!, ...patch } } : d);
  }
  function setAggregator(patch: Partial<AggregatorConfig>) {
    setDraft((d) => d ? { ...d, aggregatorConfig: { ...d.aggregatorConfig!, ...patch } } : d);
  }
  function setHuman(patch: Partial<HumanConfig>) {
    setDraft((d) => d ? { ...d, humanConfig: { ...d.humanConfig!, ...patch } } : d);
  }
  function setTool(patch: Partial<ToolConfig>) {
    setDraft((d) => d ? { ...d, toolConfig: { ...d.toolConfig!, ...patch } } : d);
  }

  const style = KIND_STYLE[node.type ?? 'llm_agent'] ?? KIND_STYLE.llm_agent;

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 px-5 py-4 border-b border-[#e0e2e6]">
        <div
          className="w-1 h-11 rounded-full shrink-0 mt-0.5"
          style={{ backgroundColor: style.dot }}
        />
        <div className="flex-1 min-w-0">
          <input
            value={draft.label}
            onChange={(e) => setDraft((d) => d ? { ...d, label: e.target.value } : d)}
            className="w-full bg-transparent text-[16px] font-semibold text-[#181d26] tracking-display outline-none placeholder:text-[rgba(4,14,32,0.38)]"
            placeholder="Node label"
          />
          <span
            className="inline-flex mt-1 items-center rounded-[6px] px-1.5 py-0.5 text-[10px] font-mono font-semibold tracking-caption border"
            style={{
              backgroundColor: style.bg,
              borderColor: style.border,
              color: style.text,
            }}
          >
            {node.type}
          </span>
        </div>
        <button
          onClick={() => selectNode(null)}
          className="w-8 h-8 rounded-[10px] flex items-center justify-center text-[rgba(4,14,32,0.55)] hover:text-[#181d26] hover:bg-[#f1f4f8] transition-colors"
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Description */}
        <Field label="Description">
          <textarea
            value={draft.description ?? ''}
            onChange={(e) => setDraft((d) => d ? { ...d, description: e.target.value } : d)}
            rows={2}
            className="input-airtable resize-none"
            placeholder="What does this node do?"
          />
        </Field>

        {/* LLM Agent config */}
        {draft.agentConfig && (
          <>
            <Field label="Role">
              <input
                value={draft.agentConfig.role}
                onChange={(e) => setAgent({ role: e.target.value })}
                className="input-airtable font-mono"
                placeholder="role_name"
              />
            </Field>

            <Field label="Model">
              <Select
                value={draft.agentConfig.model}
                onChange={(v) => setAgent({ model: v as ModelId })}
                options={MODELS.map(([id, label]) => ({ value: id, label }))}
              />
            </Field>

            <Field label="Temperature">
              <div className="flex items-center gap-3">
                <input
                  type="range" min={0} max={1} step={0.05}
                  value={draft.agentConfig.temperature}
                  onChange={(e) => setAgent({ temperature: parseFloat(e.target.value) })}
                  className="flex-1 accent-[#1b61c9]"
                />
                <span className="text-[13px] text-[#181d26] font-mono font-semibold w-10 text-right tabular-nums">
                  {draft.agentConfig.temperature.toFixed(2)}
                </span>
              </div>
            </Field>

            <Field label="Max tokens">
              <input
                type="number" min={64} max={32768} step={64}
                value={draft.agentConfig.maxTokens}
                onChange={(e) => setAgent({ maxTokens: parseInt(e.target.value) })}
                className="input-airtable"
              />
            </Field>

            <Field label="System prompt">
              <PromptEditor
                value={draft.agentConfig.systemPrompt}
                onChange={(v) => setAgent({ systemPrompt: v })}
              />
            </Field>

            <Field
              label="Output schema"
              hint="Fields this agent returns in its JSON output. Downstream decision/loop nodes reference these as {{role.field}}."
            >
              <OutputSchemaEditor
                value={draft.agentConfig.outputSchema ?? []}
                onChange={(v: OutputField[]) => setAgent({ outputSchema: v })}
              />
            </Field>
          </>
        )}

        {/* Decision config */}
        {draft.decisionConfig && (
          <>
            <Field
              label="Condition"
              hint="Use {{role.field}} to reference an upstream agent's declared output."
            >
              <ConditionEditor
                value={draft.decisionConfig.condition}
                onChange={(v) => setDecision({ condition: v })}
                upstream={upstream}
                accent="#d97706"
                placeholder="e.g. {{grader.score}} >= 0.8"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="True label">
                <input
                  value={draft.decisionConfig.trueLabel}
                  onChange={(e) => setDecision({ trueLabel: e.target.value })}
                  className="input-airtable !border-[#a8d9bd] !bg-[#e7f6ee] !text-[#15803d] focus:!border-[#15803d]"
                />
              </Field>
              <Field label="False label">
                <input
                  value={draft.decisionConfig.falseLabel}
                  onChange={(e) => setDecision({ falseLabel: e.target.value })}
                  className="input-airtable !border-[#f1b4c0] !bg-[#fbe7ec] !text-[#be123c] focus:!border-[#be123c]"
                />
              </Field>
            </div>
          </>
        )}

        {/* Loop config */}
        {draft.loopConfig && (
          <>
            <Field label="Max iterations">
              <input
                type="number" min={1} max={100}
                value={draft.loopConfig.maxIterations}
                onChange={(e) => setLoop({ maxIterations: parseInt(e.target.value) })}
                className="input-airtable"
              />
            </Field>
            <Field
              label="Break condition"
              hint="Loop exits when this expression is true. Use {{role.field}} to reference upstream agents."
            >
              <ConditionEditor
                value={draft.loopConfig.breakCondition}
                onChange={(v) => setLoop({ breakCondition: v })}
                upstream={upstream}
                accent="#7c3aed"
                placeholder="e.g. {{critic.score}} >= 0.85"
              />
            </Field>
          </>
        )}

        {/* Parallel config */}
        {draft.parallelConfig && (
          <>
            <Field label="Parallel count">
              <input
                type="number" min={2} max={32}
                value={draft.parallelConfig.numParallel}
                onChange={(e) => setParallel({ numParallel: parseInt(e.target.value) })}
                className="input-airtable"
              />
            </Field>
            <Field label="Label">
              <input
                value={draft.parallelConfig.label ?? ''}
                onChange={(e) => setParallel({ label: e.target.value })}
                className="input-airtable"
              />
            </Field>
          </>
        )}

        {/* Aggregator config */}
        {draft.aggregatorConfig && (
          <>
            <Field label="Strategy">
              <Select
                value={draft.aggregatorConfig.strategy}
                onChange={(v) => setAggregator({ strategy: v as AggregatorConfig['strategy'] })}
                options={(['all', 'best', 'vote', 'first', 'concat'] as const).map((s) => ({ value: s, label: s }))}
              />
            </Field>
            <Field label="Selection criteria">
              <input
                value={draft.aggregatorConfig.selectionCriteria ?? ''}
                onChange={(e) => setAggregator({ selectionCriteria: e.target.value })}
                className="input-airtable"
                placeholder="e.g. highest score"
              />
            </Field>
          </>
        )}

        {/* Human config */}
        {draft.humanConfig && (
          <>
            <Field label="Prompt">
              <textarea
                value={draft.humanConfig.prompt}
                onChange={(e) => setHuman({ prompt: e.target.value })}
                rows={3}
                className="input-airtable resize-none"
              />
            </Field>
            <label className="flex items-center gap-2.5 cursor-pointer px-3 py-2.5 rounded-[10px] bg-[#f8fafc] border border-[#e0e2e6] hover:border-[#cbd0d7] transition-colors">
              <input
                type="checkbox"
                checked={draft.humanConfig.approvalRequired}
                onChange={(e) => setHuman({ approvalRequired: e.target.checked })}
                className="accent-[#1b61c9] w-4 h-4"
              />
              <span className="text-[12px] text-[#181d26] tracking-ui font-medium">
                Requires approval
              </span>
            </label>
          </>
        )}

        {/* Tool config */}
        {draft.toolConfig && (
          <>
            <Field label="Tool name">
              <input
                value={draft.toolConfig.toolName}
                onChange={(e) => setTool({ toolName: e.target.value })}
                className="input-airtable font-mono"
              />
            </Field>
            <Field label="Description">
              <input
                value={draft.toolConfig.description}
                onChange={(e) => setTool({ description: e.target.value })}
                className="input-airtable"
              />
            </Field>
            <Field label="API endpoint">
              <input
                value={draft.toolConfig.apiEndpoint ?? ''}
                onChange={(e) => setTool({ apiEndpoint: e.target.value })}
                className="input-airtable font-mono"
                placeholder="https://..."
              />
            </Field>
          </>
        )}
      </div>

      {/* Save */}
      <div className="px-5 py-4 border-t border-[#e0e2e6] bg-white">
        <button
          onClick={save}
          className={`w-full h-10 rounded-[12px] text-[13px] font-semibold tracking-ui transition-all ${
            saved
              ? 'bg-[#006400] text-white shadow-[0_1px_3px_rgba(0,100,0,0.28)]'
              : 'bg-[#1b61c9] hover:bg-[#1755b1] text-white shadow-[0_1px_3px_rgba(45,127,249,0.28)]'
          }`}
        >
          {saved ? '✓ Saved' : 'Save changes'}
        </button>
      </div>

      {/* Shared input styles */}
      <style jsx>{`
        :global(.input-airtable) {
          width: 100%;
          background: #ffffff;
          border: 1px solid #e0e2e6;
          border-radius: 10px;
          padding: 8px 12px;
          font-size: 13px;
          color: #181d26;
          letter-spacing: 0.08px;
          transition: border-color 0.12s ease, box-shadow 0.12s ease, background-color 0.12s ease;
        }
        :global(.input-airtable::placeholder) {
          color: rgba(4, 14, 32, 0.38);
        }
        :global(.input-airtable:hover) {
          border-color: #cbd0d7;
        }
        :global(.input-airtable:focus) {
          border-color: #1b61c9;
          box-shadow: 0 0 0 3px rgba(27, 97, 201, 0.12);
          outline: none;
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-caption text-[rgba(4,14,32,0.55)] font-semibold mb-1.5">
        {label}
      </label>
      {hint && (
        <p className="text-[11px] text-[rgba(4,14,32,0.55)] tracking-ui leading-snug mb-2">
          {hint}
        </p>
      )}
      {children}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-airtable appearance-none pr-8 cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        strokeWidth={2}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgba(4,14,32,0.55)] pointer-events-none"
      />
    </div>
  );
}
