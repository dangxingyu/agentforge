import type { Pipeline, FlowNode, FlowEdge, NodeKind, NodeData } from '@/types/pipeline';
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
      prompts[node.data.agentConfig.role] = {
        system: node.data.agentConfig.systemPrompt,
        model: node.data.agentConfig.model,
        temperature: node.data.agentConfig.temperature,
        max_tokens: node.data.agentConfig.maxTokens,
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
      decisionConfig: { condition: 'score >= 0.8', trueLabel: 'Pass', falseLabel: 'Retry' },
    },
    loop: {
      label: 'Loop',
      description: 'Iterate until condition met',
      loopConfig: { maxIterations: 5, breakCondition: 'quality >= threshold' },
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
