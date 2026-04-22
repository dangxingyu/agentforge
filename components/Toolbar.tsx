'use client';
import { useState } from 'react';
import { Download, Upload, Layers, ChevronDown, Plus, Save } from 'lucide-react';
import { usePipelineStore } from '@/store/pipelineStore';
import { TEMPLATES } from '@/lib/templates';
import { exportPipelineYAML, exportPromptsYAML, createNode, generatePipelineId } from '@/lib/pipeline';
import type { NodeKind } from '@/types/pipeline';

const NODE_TYPES: { kind: NodeKind; label: string; color: string }[] = [
  { kind: 'llm_agent', label: 'LLM Agent', color: 'text-indigo-400' },
  { kind: 'parallel', label: 'Parallel Fan-out', color: 'text-green-400' },
  { kind: 'aggregator', label: 'Aggregator', color: 'text-cyan-400' },
  { kind: 'decision', label: 'Decision', color: 'text-amber-400' },
  { kind: 'loop', label: 'Loop', color: 'text-purple-400' },
  { kind: 'human', label: 'Human Review', color: 'text-rose-400' },
  { kind: 'tool', label: 'Tool Call', color: 'text-orange-400' },
];

export default function Toolbar() {
  const { nodes, edges, pipeline, loadTemplate, setNodes, setEdges } = usePipelineStore();
  const [showTemplates, setShowTemplates] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showExport, setShowExport] = useState(false);

  const fullPipeline = pipeline
    ? { ...pipeline, nodes, edges }
    : { id: generatePipelineId(), name: 'Untitled Pipeline', description: '', nodes, edges, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };

  function downloadFile(content: string, filename: string) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleAddNode(kind: NodeKind) {
    const newNode = createNode(kind, { x: Math.random() * 400 + 100, y: Math.random() * 400 + 100 });
    setNodes([...nodes, newNode]);
    setShowAdd(false);
  }

  function handleImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.nodes && data.edges) {
          setNodes(data.nodes);
          setEdges(data.edges);
        }
      } catch {
        alert('Invalid pipeline JSON file');
      }
    };
    input.click();
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 backdrop-blur">
      <div className="flex items-center gap-1.5">
        <div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center">
          <Layers size={13} className="text-white" />
        </div>
        <span className="text-sm font-semibold text-slate-200">{pipeline?.name ?? 'AgentForge'}</span>
      </div>

      <div className="flex-1" />

      {/* Templates */}
      <div className="relative">
        <button
          onClick={() => { setShowTemplates(!showTemplates); setShowAdd(false); setShowExport(false); }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors"
        >
          <Layers size={13} /> Templates <ChevronDown size={11} />
        </button>
        {showTemplates && (
          <div className="absolute right-0 top-full mt-1 z-50 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => { loadTemplate(t.id); setShowTemplates(false); }}
                className="w-full text-left px-4 py-3 hover:bg-slate-800 transition-colors border-b border-slate-800 last:border-0"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-200">{t.name}</span>
                  <span className="text-[10px] text-slate-500 bg-slate-800 rounded px-1.5 py-0.5">{t.category}</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{t.description}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Add node */}
      <div className="relative">
        <button
          onClick={() => { setShowAdd(!showAdd); setShowTemplates(false); setShowExport(false); }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors"
        >
          <Plus size={13} /> Add Node
        </button>
        {showAdd && (
          <div className="absolute right-0 top-full mt-1 z-50 w-52 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
            {NODE_TYPES.map((nt) => (
              <button
                key={nt.kind}
                onClick={() => handleAddNode(nt.kind)}
                className="w-full text-left px-4 py-2.5 hover:bg-slate-800 transition-colors border-b border-slate-800 last:border-0"
              >
                <span className={`text-sm font-medium ${nt.color}`}>{nt.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Export */}
      <div className="relative">
        <button
          onClick={() => { setShowExport(!showExport); setShowTemplates(false); setShowAdd(false); }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors"
        >
          <Download size={13} /> Export <ChevronDown size={11} />
        </button>
        {showExport && (
          <div className="absolute right-0 top-full mt-1 z-50 w-52 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
            <button onClick={() => { downloadFile(exportPipelineYAML(fullPipeline), 'pipeline.yaml'); setShowExport(false); }}
              className="w-full text-left px-4 py-3 hover:bg-slate-800 text-sm text-slate-300 border-b border-slate-800">
              Pipeline YAML
            </button>
            <button onClick={() => { downloadFile(exportPromptsYAML(fullPipeline), 'prompts.yaml'); setShowExport(false); }}
              className="w-full text-left px-4 py-3 hover:bg-slate-800 text-sm text-slate-300 border-b border-slate-800">
              Prompts YAML
            </button>
            <button onClick={() => { downloadFile(JSON.stringify(fullPipeline, null, 2), 'pipeline.json'); setShowExport(false); }}
              className="w-full text-left px-4 py-3 hover:bg-slate-800 text-sm text-slate-300">
              Pipeline JSON
            </button>
          </div>
        )}
      </div>

      <button
        onClick={handleImport}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors"
      >
        <Upload size={13} /> Import
      </button>
    </div>
  );
}
