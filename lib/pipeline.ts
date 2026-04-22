import type {
  Pipeline,
  FlowNode,
  FlowEdge,
  NodeKind,
  NodeData,
  OutputField,
} from '@/types/pipeline';
import YAML from 'yaml';

export function exportPipelineYAML(pipeline: Pipeline): string {
  const config = {
    name: pipeline.name,
    description: pipeline.description,
    nodes: pipeline.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      label: n.data.label,
      description: n.data.description,
      config: getNodeConfig(n),
    })),
    edges: pipeline.edges.map((e) => ({
      from: e.source,
      to: e.target,
      label: e.label,
      ...(e.sourceHandle ? { handle: e.sourceHandle } : {}),
    })),
  };
  return YAML.stringify(config);
}

function getNodeConfig(node: FlowNode): Record<string, unknown> {
  const { data } = node;
  if (data.agentConfig) return { ...data.agentConfig };
  if (data.parallelConfig) return { ...data.parallelConfig };
  if (data.aggregatorConfig) return { ...data.aggregatorConfig };
  if (data.decisionConfig) return { ...data.decisionConfig };
  if (data.loopConfig) return { ...data.loopConfig };
  if (data.humanConfig) return { ...data.humanConfig };
  if (data.toolConfig) return { ...data.toolConfig };
  return {};
}

export function exportPromptsYAML(pipeline: Pipeline): string {
  const prompts: Record<string, unknown> = {};
  for (const node of pipeline.nodes) {
    if (node.data.agentConfig) {
      const a = node.data.agentConfig;
      prompts[a.role] = {
        system: a.systemPrompt,
        model: a.model,
        temperature: a.temperature,
        max_tokens: a.maxTokens,
        ...(a.outputSchema && a.outputSchema.length > 0
          ? { output_schema: a.outputSchema }
          : {}),
      };
    }
  }
  return YAML.stringify(prompts);
}

export function createNode(kind: NodeKind, position: { x: number; y: number }): FlowNode {
  const id = `${kind}_${Date.now()}`;
  const defaults: Record<NodeKind, NodeData> = {
    llm_agent: {
      label: 'LLM Agent',
      description: 'Language model agent',
      agentConfig: {
        role: 'agent',
        model: 'claude-sonnet-4-6',
        systemPrompt: 'You are a helpful AI assistant.',
        temperature: 0.7,
        maxTokens: 2048,
        outputSchema: [],
      },
    },
    parallel: {
      label: 'Parallel Fan-out',
      description: 'Spawn parallel instances',
      parallelConfig: { numParallel: 3, label: 'parallel instances' },
    },
    aggregator: {
      label: 'Aggregator',
      description: 'Collect and merge parallel results',
      aggregatorConfig: { strategy: 'all' },
    },
    decision: {
      label: 'Decision',
      description: 'Branch based on condition',
      decisionConfig: {
        condition: '',
        trueLabel: 'Pass',
        falseLabel: 'Retry',
      },
    },
    loop: {
      label: 'Loop',
      description: 'Iterate until condition met',
      loopConfig: { maxIterations: 5, breakCondition: '' },
    },
    human: {
      label: 'Human Review',
      description: 'Pause for human input',
      humanConfig: { prompt: 'Please review and approve.', approvalRequired: true },
    },
    tool: {
      label: 'Tool Call',
      description: 'External function or API',
      toolConfig: { toolName: 'my_tool', description: 'Calls an external tool' },
    },
    input: { label: 'Input', description: 'Pipeline entry point' },
    output: { label: 'Output', description: 'Pipeline exit point' },
  };

  return { id, type: kind, position, data: defaults[kind] };
}

export function generatePipelineId(): string {
  return `pipeline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Variable reference resolution ────────────────────────────────────────────
//
// Conditions use `{{role.field}}` template syntax to reference the output of
// an upstream LLM agent node by its declared outputSchema. For example:
//   `{{grader.score}} >= 0.8`
// means: the `score` field from the agent whose role == "grader" in its
// outputSchema. This makes the spec self-checking — if no upstream agent
// declares `grader.score`, the condition is flagged as unresolved in the UI.

const REF_REGEX = /\{\{\s*([\w-]+)\s*\.\s*([\w-]+)\s*\}\}/g;

export interface VariableRef {
  /** Original matched token, e.g. "{{grader.score}}" */
  raw: string;
  /** Agent role (left side of the dot) */
  role: string;
  /** Output field name (right side of the dot) */
  field: string;
}

/** Extract all `{{role.field}}` references from a condition string. */
export function parseVariableRefs(expression: string): VariableRef[] {
  if (!expression) return [];
  const refs: VariableRef[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(REF_REGEX);
  while ((m = re.exec(expression)) !== null) {
    refs.push({ raw: m[0], role: m[1], field: m[2] });
  }
  return refs;
}

export interface UpstreamField {
  /** Source node id — useful for hover / disambiguation. */
  sourceNodeId: string;
  /** Source node label for display. */
  sourceLabel: string;
  /** Agent role (used as the reference prefix). */
  role: string;
  field: OutputField;
}

/** Minimal node shape needed for upstream traversal. Accepts both our typed
 * FlowNode and the generic Node that reactflow's internal store returns. */
type UpstreamNode = { id: string; data: NodeData; type?: string };
type UpstreamEdge = { source: string; target: string };

/**
 * Walk edges backward from `nodeId` and collect every reachable LLM-agent
 * upstream node's outputSchema. Used by decision/loop condition editors to
 * build autocomplete chips and by canvas renderers to flag unresolved refs.
 */
export function collectUpstreamSchemas(
  nodeId: string,
  nodes: UpstreamNode[],
  edges: UpstreamEdge[]
): UpstreamField[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  // reverse adjacency: for each target, the set of source ids
  const rev = new Map<string, Set<string>>();
  for (const e of edges) {
    if (!rev.has(e.target)) rev.set(e.target, new Set());
    rev.get(e.target)!.add(e.source);
  }

  const visited = new Set<string>();
  const stack: string[] = [nodeId];
  const found: UpstreamField[] = [];

  while (stack.length) {
    const cur = stack.pop()!;
    if (visited.has(cur)) continue;
    visited.add(cur);
    const sources = rev.get(cur);
    if (!sources) continue;
    for (const s of sources) {
      if (visited.has(s)) continue;
      const srcNode = byId.get(s);
      if (!srcNode) continue;

      const agent = srcNode.data.agentConfig;
      if (agent?.outputSchema && agent.outputSchema.length > 0) {
        for (const field of agent.outputSchema) {
          found.push({
            sourceNodeId: srcNode.id,
            sourceLabel: srcNode.data.label,
            role: agent.role,
            field,
          });
        }
      }
      stack.push(s);
    }
  }

  return found;
}

/**
 * Given an expression and the set of available upstream fields, return the
 * subset of references in the expression that cannot be resolved.
 */
export function findUnresolvedRefs(
  expression: string,
  upstream: UpstreamField[]
): VariableRef[] {
  const refs = parseVariableRefs(expression);
  return refs.filter(
    (r) => !upstream.some((u) => u.role === r.role && u.field.name === r.field)
  );
}
