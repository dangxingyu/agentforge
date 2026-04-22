import { describe, it, expect } from 'vitest';
import { TEMPLATES } from '@/lib/templates';
import type { NodeKind } from '@/types/pipeline';

// ─── Handle registry ─────────────────────────────────────────────────────────
// Maps each node type to the set of Handle IDs it exposes.
// `null` represents the default handle (no explicit id prop).

interface HandleDef {
  sourceHandles: (string | null)[];
  targetHandles: (string | null)[];
}

const HANDLE_REGISTRY: Record<NodeKind, HandleDef> = {
  llm_agent: { sourceHandles: [null], targetHandles: [null] },
  parallel: { sourceHandles: [null], targetHandles: [null] },
  aggregator: { sourceHandles: [null], targetHandles: [null] },
  decision: { sourceHandles: ['true', 'false'], targetHandles: [null] },
  loop: { sourceHandles: [null], targetHandles: [null] },
  human: { sourceHandles: [null], targetHandles: [null] },
  tool: { sourceHandles: [null], targetHandles: [null] },
  input: { sourceHandles: [null], targetHandles: [] }, // input: source only
  output: { sourceHandles: [], targetHandles: [null] }, // output: target only
};

// ─── nodeTypes registry keys ─────────────────────────────────────────────────
// Must match the keys in Canvas.tsx `nodeTypes` object.

const NODE_TYPE_KEYS: Set<string> = new Set<string>([
  'llm_agent',
  'decision',
  'parallel',
  'aggregator',
  'loop',
  'input',
  'output',
  'tool',
  'human',
]);

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Template data integrity', () => {
  for (const template of TEMPLATES) {
    describe(`Template: ${template.name} (${template.id})`, () => {
      const { nodes, edges } = template.pipeline;
      const nodeIds = new Set(nodes.map((n) => n.id));
      const nodeMap = new Map(nodes.map((n) => [n.id, n]));

      // ── No duplicate node IDs ──────────────────────────────────────────
      it('has no duplicate node IDs', () => {
        const ids = nodes.map((n) => n.id);
        const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
        expect(duplicates).toEqual([]);
      });

      // ── All node types are registered ──────────────────────────────────
      it('all node types match nodeTypes registry', () => {
        for (const node of nodes) {
          expect(
            NODE_TYPE_KEYS.has(node.type!),
            `Node "${node.id}" has type "${node.type}" which is not in nodeTypes registry`
          ).toBe(true);
        }
      });

      // ── All edge sources and targets reference valid node IDs ──────────
      it('all edge sources reference valid node IDs', () => {
        for (const edge of edges) {
          expect(
            nodeIds.has(edge.source),
            `Edge "${edge.id}" references source "${edge.source}" which doesn't exist. Valid IDs: ${[...nodeIds].join(', ')}`
          ).toBe(true);
        }
      });

      it('all edge targets reference valid node IDs', () => {
        for (const edge of edges) {
          expect(
            nodeIds.has(edge.target),
            `Edge "${edge.id}" references target "${edge.target}" which doesn't exist. Valid IDs: ${[...nodeIds].join(', ')}`
          ).toBe(true);
        }
      });

      // ── sourceHandle values match Handle IDs on source nodes ───────────
      it('all sourceHandle values match Handle IDs on source nodes', () => {
        for (const edge of edges) {
          const sourceNode = nodeMap.get(edge.source);
          if (!sourceNode) continue; // already caught by the source-validity test

          const nodeType = sourceNode.type as NodeKind;
          const validHandles = HANDLE_REGISTRY[nodeType]?.sourceHandles ?? [];
          const handleValue = edge.sourceHandle ?? null;

          expect(
            validHandles.includes(handleValue),
            `Edge "${edge.id}": sourceHandle "${edge.sourceHandle ?? '(default)'}" ` +
              `doesn't match any source Handle on "${sourceNode.id}" (type: ${nodeType}). ` +
              `Valid handles: ${validHandles.map((h) => h ?? '(default)').join(', ')}`
          ).toBe(true);
        }
      });

      // ── targetHandle values match Handle IDs on target nodes ───────────
      it('all targetHandle values match Handle IDs on target nodes', () => {
        for (const edge of edges) {
          const targetNode = nodeMap.get(edge.target);
          if (!targetNode) continue;

          const nodeType = targetNode.type as NodeKind;
          const validHandles = HANDLE_REGISTRY[nodeType]?.targetHandles ?? [];
          const handleValue = edge.targetHandle ?? null;

          expect(
            validHandles.includes(handleValue),
            `Edge "${edge.id}": targetHandle "${edge.targetHandle ?? '(default)'}" ` +
              `doesn't match any target Handle on "${targetNode.id}" (type: ${nodeType}). ` +
              `Valid handles: ${validHandles.map((h) => h ?? '(default)').join(', ')}`
          ).toBe(true);
        }
      });

      // ── No edges connect to handles that don't exist on a node type ────
      it('source nodes have source handles (not output-only nodes used as sources)', () => {
        for (const edge of edges) {
          const sourceNode = nodeMap.get(edge.source);
          if (!sourceNode) continue;

          const nodeType = sourceNode.type as NodeKind;
          const handles = HANDLE_REGISTRY[nodeType];
          expect(
            handles.sourceHandles.length > 0,
            `Edge "${edge.id}": source node "${sourceNode.id}" (type: ${nodeType}) has no source handles — it cannot be a source`
          ).toBe(true);
        }
      });

      it('target nodes have target handles (not input-only nodes used as targets)', () => {
        for (const edge of edges) {
          const targetNode = nodeMap.get(edge.target);
          if (!targetNode) continue;

          const nodeType = targetNode.type as NodeKind;
          const handles = HANDLE_REGISTRY[nodeType];
          expect(
            handles.targetHandles.length > 0,
            `Edge "${edge.id}": target node "${targetNode.id}" (type: ${nodeType}) has no target handles — it cannot be a target`
          ).toBe(true);
        }
      });

      // ── No duplicate edge IDs ──────────────────────────────────────────
      it('has no duplicate edge IDs', () => {
        const ids = edges.map((e) => e.id);
        const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
        expect(duplicates).toEqual([]);
      });

      // ── Node positions are reasonable (visible, not overlapping) ───────
      it('node positions are within visible range', () => {
        for (const node of nodes) {
          expect(node.position.x).toBeGreaterThanOrEqual(0);
          expect(node.position.y).toBeGreaterThanOrEqual(0);
          expect(node.position.x).toBeLessThan(5000);
          expect(node.position.y).toBeLessThan(5000);
        }
      });

      it('no two nodes share the exact same position', () => {
        const positions = nodes.map((n) => `${n.position.x},${n.position.y}`);
        const duplicates = positions.filter((p, i) => positions.indexOf(p) !== i);
        expect(
          duplicates,
          `Overlapping node positions: ${duplicates.join('; ')}`
        ).toEqual([]);
      });

      // ── Every node has a label ─────────────────────────────────────────
      it('every node has a non-empty label', () => {
        for (const node of nodes) {
          expect(
            node.data.label?.trim().length,
            `Node "${node.id}" has no label`
          ).toBeGreaterThan(0);
        }
      });
    });
  }
});

describe('Handle registry completeness', () => {
  it('HANDLE_REGISTRY covers all NodeKind values', () => {
    const kinds: NodeKind[] = [
      'llm_agent',
      'parallel',
      'aggregator',
      'decision',
      'loop',
      'human',
      'tool',
      'input',
      'output',
    ];
    for (const kind of kinds) {
      expect(
        HANDLE_REGISTRY[kind],
        `Missing HANDLE_REGISTRY entry for "${kind}"`
      ).toBeDefined();
    }
  });

  it('NODE_TYPE_KEYS covers all NodeKind values', () => {
    const kinds: NodeKind[] = [
      'llm_agent',
      'parallel',
      'aggregator',
      'decision',
      'loop',
      'human',
      'tool',
      'input',
      'output',
    ];
    for (const kind of kinds) {
      expect(
        NODE_TYPE_KEYS.has(kind),
        `Missing NODE_TYPE_KEYS entry for "${kind}"`
      ).toBe(true);
    }
  });
});
