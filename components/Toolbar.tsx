'use client';
import { useState, useRef, useEffect } from 'react';
import { Download, Upload, Layers, ChevronDown, Plus, Play } from 'lucide-react';
import { usePipelineStore } from '@/store/pipelineStore';
import { TEMPLATES } from '@/lib/templates';
import { exportPipelineYAML, exportPromptsYAML, createNode, generatePipelineId } from '@/lib/pipeline';
import type { NodeKind } from '@/types/pipeline';

interface ToolbarProps {
  onRunClick?: () => void;
  runActive?: boolean;
}

const NODE_TYPES: { kind: NodeKind; label: string; dot: string }[] = [
  { kind: 'llm_agent', label: 'LLM Agent', dot: '#1b61c9' },
  { kind: 'parallel', label: 'Parallel Fan-out', dot: '#16a34a' },
  { kind: 'aggregator', label: 'Aggregator', dot: '#0891b2' },
  { kind: 'decision', label: 'Decision', dot: '#d97706' },
  { kind: 'loop', label: 'Loop', dot: '#7c3aed' },
  { kind: 'human', label: 'Human Review', dot: '#e11d48' },
  { kind: 'tool', label: 'Tool Call', dot: '#ea580c' },
];

export default function Toolbar({ onRunClick, runActive }: ToolbarProps = {}) {
  const { nodes, edges, pipeline, loadTemplate, setNodes, setEdges } = usePipelineStore();
  const [open, setOpen] = useState<null | 'templates' | 'add' | 'export'>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close popovers on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(null);
    }
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, []);

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
    setOpen(null);
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
    <div
      ref={rootRef}
      className="flex items-center gap-2 px-5 h-14 bg-white border-b border-[#e0e2e6]"
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-[10px] bg-[#1b61c9] flex items-center justify-center shadow-[0_1px_3px_rgba(45,127,249,0.28)]">
          <Layers size={15} className="text-white" strokeWidth={2.2} />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-[15px] font-semibold text-[#181d26] tracking-display">
            AgentForge
          </span>
          {pipeline?.name && (
            <>
              <span className="text-[#e0e2e6]">/</span>
              <span className="text-[13px] text-[rgba(4,14,32,0.69)] tracking-ui">
                {pipeline.name}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex-1" />

      {/* Templates */}
      <div className="relative">
        <SecondaryButton
          onClick={() => setOpen(open === 'templates' ? null : 'templates')}
          active={open === 'templates'}
        >
          <Layers size={14} strokeWidth={2} /> Templates
          <ChevronDown size={12} strokeWidth={2.2} className="opacity-60" />
        </SecondaryButton>
        {open === 'templates' && (
          <Popover>
            <PopoverHeader>Pipeline templates</PopoverHeader>
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => { loadTemplate(t.id); setOpen(null); }}
                className="w-full text-left px-4 py-3 hover:bg-[#f8fafc] transition-colors border-t border-[#e0e2e6] first:border-t-0"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[13px] font-semibold text-[#181d26] tracking-ui">{t.name}</span>
                  <span className="text-[10px] tracking-caption font-medium text-[#1b61c9] bg-[#eef3fb] rounded-[6px] px-1.5 py-0.5 uppercase">
                    {t.category}
                  </span>
                </div>
                <p className="text-[12px] text-[rgba(4,14,32,0.55)] mt-0.5 leading-relaxed">{t.description}</p>
              </button>
            ))}
          </Popover>
        )}
      </div>

      {/* Add node */}
      <div className="relative">
        <SecondaryButton
          onClick={() => setOpen(open === 'add' ? null : 'add')}
          active={open === 'add'}
        >
          <Plus size={14} strokeWidth={2.2} /> Add node
        </SecondaryButton>
        {open === 'add' && (
          <Popover widthClass="w-56">
            <PopoverHeader>Insert node</PopoverHeader>
            {NODE_TYPES.map((nt) => (
              <button
                key={nt.kind}
                onClick={() => handleAddNode(nt.kind)}
                className="w-full text-left px-4 py-2.5 hover:bg-[#f8fafc] transition-colors border-t border-[#e0e2e6] first:border-t-0 flex items-center gap-2.5"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: nt.dot }}
                />
                <span className="text-[13px] font-medium text-[#181d26] tracking-ui">{nt.label}</span>
              </button>
            ))}
          </Popover>
        )}
      </div>

      {/* Import */}
      <SecondaryButton onClick={handleImport}>
        <Upload size={14} strokeWidth={2} /> Import
      </SecondaryButton>

      {/* Export */}
      <div className="relative">
        <SecondaryButton
          onClick={() => setOpen(open === 'export' ? null : 'export')}
          active={open === 'export'}
        >
          <Download size={14} strokeWidth={2} /> Export
          <ChevronDown size={12} strokeWidth={2.2} className="opacity-60" />
        </SecondaryButton>
        {open === 'export' && (
          <Popover>
            <PopoverHeader>Export pipeline</PopoverHeader>
            <ExportItem
              label="Pipeline YAML"
              sub="Config for the runtime"
              onClick={() => { downloadFile(exportPipelineYAML(fullPipeline), 'pipeline.yaml'); setOpen(null); }}
            />
            <ExportItem
              label="Prompts YAML"
              sub="All system prompts"
              onClick={() => { downloadFile(exportPromptsYAML(fullPipeline), 'prompts.yaml'); setOpen(null); }}
            />
            <ExportItem
              label="Pipeline JSON"
              sub="For re-import / sharing"
              onClick={() => { downloadFile(JSON.stringify(fullPipeline, null, 2), 'pipeline.json'); setOpen(null); }}
            />
          </Popover>
        )}
      </div>

      {/* Run (primary CTA) */}
      {onRunClick && (
        <button
          onClick={onRunClick}
          className={`flex items-center gap-1.5 px-4 h-9 text-[13px] font-semibold rounded-[12px] transition-colors tracking-ui focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#15803d] ${
            runActive
              ? 'bg-[#0f5e2e] text-white shadow-[0_1px_3px_rgba(22,163,74,0.35)]'
              : 'bg-[#15803d] hover:bg-[#0f5e2e] text-white shadow-[0_1px_3px_rgba(22,163,74,0.28)]'
          }`}
        >
          <Play size={13} strokeWidth={2.2} className="fill-current" />
          Run
        </button>
      )}
    </div>
  );
}

/* ── Toolbar primitives ──────────────────────────────────────────────────── */

function SecondaryButton({
  children,
  onClick,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 h-9 text-[13px] font-medium rounded-[12px] transition-colors tracking-ui border ${
        active
          ? 'bg-[#eef3fb] border-[#bcd0ee] text-[#1b61c9]'
          : 'bg-white border-[#e0e2e6] text-[#181d26] hover:bg-[#f8fafc] hover:border-[#cbd0d7]'
      }`}
    >
      {children}
    </button>
  );
}

function Popover({
  children,
  widthClass = 'w-72',
}: {
  children: React.ReactNode;
  widthClass?: string;
}) {
  return (
    <div
      className={`absolute right-0 top-full mt-2 z-50 ${widthClass} bg-white rounded-[16px] overflow-hidden border border-[#e0e2e6] shadow-[0_0_0_1px_rgba(15,48,106,0.06),0_8px_24px_rgba(15,48,106,0.10),0_2px_6px_rgba(15,48,106,0.06)]`}
    >
      {children}
    </div>
  );
}

function PopoverHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-2.5 text-[10px] uppercase tracking-caption font-semibold text-[rgba(4,14,32,0.55)] bg-[#f8fafc]">
      {children}
    </div>
  );
}

function ExportItem({
  label,
  sub,
  onClick,
}: {
  label: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3 hover:bg-[#f8fafc] transition-colors border-t border-[#e0e2e6]"
    >
      <div className="text-[13px] font-semibold text-[#181d26] tracking-ui">{label}</div>
      <div className="text-[11px] text-[rgba(4,14,32,0.55)] tracking-ui mt-0.5">{sub}</div>
    </button>
  );
}
