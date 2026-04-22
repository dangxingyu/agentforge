'use client';
import { useState, useEffect } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { usePipelineStore } from '@/store/pipelineStore';
import type { NodeData, ModelId, LLMAgentConfig, DecisionConfig, LoopConfig, ParallelConfig, AggregatorConfig, HumanConfig, ToolConfig } from '@/types/pipeline';
import { MODEL_LABELS } from '@/types/pipeline';
import PromptEditor from './PromptEditor';

const MODELS = Object.entries(MODEL_LABELS) as [ModelId, string][];

export default function NodeDetail() {
  const { nodes, selectedNodeId, selectNode, updateNodeData } = usePipelineStore();
  const node = nodes.find((n) => n.id === selectedNodeId);
  const [draft, setDraft] = useState<NodeData | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (node) setDraft(JSON.parse(JSON.stringify(node.data)));
  }, [selectedNodeId]);

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

  const kindColors: Record<string, string> = {
    llm_agent: 'text-indigo-400 bg-indigo-950/50 border-indigo-800',
    decision: 'text-amber-400 bg-amber-950/50 border-amber-800',
    parallel: 'text-green-400 bg-green-950/50 border-green-800',
    aggregator: 'text-cyan-400 bg-cyan-950/50 border-cyan-800',
    loop: 'text-purple-400 bg-purple-950/50 border-purple-800',
    human: 'text-rose-400 bg-rose-950/50 border-rose-800',
    tool: 'text-orange-400 bg-orange-950/50 border-orange-800',
    input: 'text-slate-400 bg-slate-800/50 border-slate-700',
    output: 'text-violet-400 bg-violet-950/50 border-violet-800',
  };
  const badgeClass = kindColors[node.type ?? 'llm_agent'] ?? kindColors.llm_agent;

  return (
    <div className="h-full flex flex-col bg-slate-950 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800">
        <div className="flex-1 min-w-0">
          <input
            value={draft.label}
            onChange={(e) => setDraft((d) => d ? { ...d, label: e.target.value } : d)}
            className="w-full bg-transparent text-sm font-semibold text-slate-100 outline-none placeholder:text-slate-600"
            placeholder="Node label"
          />
          <span className={`inline-flex mt-0.5 items-center rounded px-1.5 py-0.5 text-[10px] font-mono font-medium border ${badgeClass}`}>
            {node.type}
          </span>
        </div>
        <button onClick={() => selectNode(null)} className="text-slate-500 hover:text-slate-300 transition-colors">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Description */}
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-medium mb-1">Description</label>
          <textarea
            value={draft.description ?? ''}
            onChange={(e) => setDraft((d) => d ? { ...d, description: e.target.value } : d)}
            rows={2}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 outline-none focus:border-indigo-600 resize-none"
            placeholder="What does this node do?"
          />
        </div>

        {/* LLM Agent config */}
        {draft.agentConfig && (
          <>
            <Section title="Role">
              <input
                value={draft.agentConfig.role}
                onChange={(e) => setAgent({ role: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 outline-none focus:border-indigo-600 font-mono"
                placeholder="role_name"
              />
            </Section>

            <Section title="Model">
              <div className="relative">
                <select
                  value={draft.agentConfig.model}
                  onChange={(e) => setAgent({ model: e.target.value as ModelId })}
                  className="w-full appearance-none bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 outline-none focus:border-indigo-600 pr-8"
                >
                  {MODELS.map(([id, label]) => (
                    <option key={id} value={id}>{label}</option>
                  ))}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              </div>
            </Section>

            <Section title="Temperature">
              <div className="flex items-center gap-3">
                <input
                  type="range" min={0} max={1} step={0.05}
                  value={draft.agentConfig.temperature}
                  onChange={(e) => setAgent({ temperature: parseFloat(e.target.value) })}
                  className="flex-1 accent-indigo-500"
                />
                <span className="text-sm text-slate-300 font-mono w-8 text-right">{draft.agentConfig.temperature}</span>
              </div>
            </Section>

            <Section title="Max Tokens">
              <input
                type="number" min={64} max={32768} step={64}
                value={draft.agentConfig.maxTokens}
                onChange={(e) => setAgent({ maxTokens: parseInt(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 outline-none focus:border-indigo-600"
              />
            </Section>

            <Section title="System Prompt">
              <PromptEditor
                value={draft.agentConfig.systemPrompt}
                onChange={(v) => setAgent({ systemPrompt: v })}
              />
            </Section>
          </>
        )}

        {/* Decision config */}
        {draft.decisionConfig && (
          <>
            <Section title="Condition">
              <input
                value={draft.decisionConfig.condition}
                onChange={(e) => setDecision({ condition: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 outline-none focus:border-amber-600 font-mono"
              />
            </Section>
            <div className="grid grid-cols-2 gap-2">
              <Section title="True label">
                <input value={draft.decisionConfig.trueLabel} onChange={(e) => setDecision({ trueLabel: e.target.value })}
                  className="w-full bg-slate-900 border border-green-900/60 rounded-lg px-3 py-2 text-sm text-green-300 outline-none focus:border-green-600" />
              </Section>
              <Section title="False label">
                <input value={draft.decisionConfig.falseLabel} onChange={(e) => setDecision({ falseLabel: e.target.value })}
                  className="w-full bg-slate-900 border border-red-900/60 rounded-lg px-3 py-2 text-sm text-red-300 outline-none focus:border-red-600" />
              </Section>
            </div>
          </>
        )}

        {/* Loop config */}
        {draft.loopConfig && (
          <>
            <Section title="Max Iterations">
              <input type="number" min={1} max={100}
                value={draft.loopConfig.maxIterations}
                onChange={(e) => setLoop({ maxIterations: parseInt(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 outline-none focus:border-purple-600" />
            </Section>
            <Section title="Break Condition">
              <input value={draft.loopConfig.breakCondition} onChange={(e) => setLoop({ breakCondition: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 outline-none focus:border-purple-600 font-mono" />
            </Section>
          </>
        )}

        {/* Parallel config */}
        {draft.parallelConfig && (
          <>
            <Section title="Parallel Count">
              <input type="number" min={2} max={32}
                value={draft.parallelConfig.numParallel}
                onChange={(e) => setParallel({ numParallel: parseInt(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 outline-none focus:border-green-600" />
            </Section>
            <Section title="Label">
              <input value={draft.parallelConfig.label ?? ''} onChange={(e) => setParallel({ label: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 outline-none focus:border-green-600" />
            </Section>
          </>
        )}

        {/* Aggregator config */}
        {draft.aggregatorConfig && (
          <>
            <Section title="Strategy">
              <div className="relative">
                <select value={draft.aggregatorConfig.strategy} onChange={(e) => setAggregator({ strategy: e.target.value as AggregatorConfig['strategy'] })}
                  className="w-full appearance-none bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 outline-none focus:border-cyan-600 pr-8">
                  {(['all', 'best', 'vote', 'first', 'concat'] as const).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              </div>
            </Section>
            <Section title="Selection Criteria">
              <input value={draft.aggregatorConfig.selectionCriteria ?? ''} onChange={(e) => setAggregator({ selectionCriteria: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 outline-none focus:border-cyan-600" placeholder="e.g. highest score" />
            </Section>
          </>
        )}

        {/* Human config */}
        {draft.humanConfig && (
          <>
            <Section title="Prompt">
              <textarea value={draft.humanConfig.prompt} onChange={(e) => setHuman({ prompt: e.target.value })} rows={3}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 outline-none focus:border-rose-600 resize-none" />
            </Section>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="approval" checked={draft.humanConfig.approvalRequired}
                onChange={(e) => setHuman({ approvalRequired: e.target.checked })}
                className="accent-rose-500 w-4 h-4" />
              <label htmlFor="approval" className="text-sm text-slate-300">Requires approval</label>
            </div>
          </>
        )}

        {/* Tool config */}
        {draft.toolConfig && (
          <>
            <Section title="Tool Name">
              <input value={draft.toolConfig.toolName} onChange={(e) => setTool({ toolName: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 outline-none focus:border-orange-600 font-mono" />
            </Section>
            <Section title="Description">
              <input value={draft.toolConfig.description} onChange={(e) => setTool({ description: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 outline-none focus:border-orange-600" />
            </Section>
            <Section title="API Endpoint">
              <input value={draft.toolConfig.apiEndpoint ?? ''} onChange={(e) => setTool({ apiEndpoint: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 outline-none focus:border-orange-600 font-mono" placeholder="https://..." />
            </Section>
          </>
        )}
      </div>

      {/* Save */}
      <div className="px-4 py-3 border-t border-slate-800">
        <button
          onClick={save}
          className={`w-full py-2 rounded-lg text-sm font-medium transition-all ${
            saved
              ? 'bg-green-700 text-green-100'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white'
          }`}
        >
          {saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-medium mb-1.5">{title}</label>
      {children}
    </div>
  );
}
