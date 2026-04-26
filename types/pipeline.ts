import type { Node, Edge } from 'reactflow';

export type NodeKind =
  | 'llm_agent'
  | 'parallel'
  | 'aggregator'
  | 'decision'
  | 'loop'
  | 'human'
  | 'tool'
  | 'input'
  | 'output';

export type ModelId =
  | 'claude-sonnet-4-6'
  | 'claude-opus-4-7'
  | 'claude-haiku-4-5-20251001'
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'gemini-2.5-pro'
  | 'gemini-2.5-pro-native'
  | 'gemini-2.5-flash-native'
  | 'gemini-2.0-flash';

export const MODEL_LABELS: Record<ModelId, string> = {
  'claude-sonnet-4-6': 'Claude Sonnet 4.6',
  'claude-opus-4-7': 'Claude Opus 4.7',
  'claude-haiku-4-5-20251001': 'Claude Haiku 4.5',
  'gpt-4o': 'GPT-4o',
  'gpt-4o-mini': 'GPT-4o Mini',
  'gemini-2.5-pro': 'Gemini 2.5 Pro',
  'gemini-2.5-pro-native': 'Gemini 2.5 Pro (native thinking)',
  'gemini-2.5-flash-native': 'Gemini 2.5 Flash (native thinking)',
  'gemini-2.0-flash': 'Gemini 2.0 Flash',
};

export const MODEL_PROVIDERS: Record<ModelId, string> = {
  'claude-sonnet-4-6': 'Anthropic',
  'claude-opus-4-7': 'Anthropic',
  'claude-haiku-4-5-20251001': 'Anthropic',
  'gpt-4o': 'OpenAI',
  'gpt-4o-mini': 'OpenAI',
  'gemini-2.5-pro': 'Google',
  'gemini-2.5-pro-native': 'Google',
  'gemini-2.5-flash-native': 'Google',
  'gemini-2.0-flash': 'Google',
};

/** Models that accept a `thinking_budget` (Gemini's reasoning-token allocation). */
export const MODELS_WITH_THINKING: ReadonlySet<ModelId> = new Set<ModelId>([
  'gemini-2.5-pro',
  'gemini-2.5-pro-native',
  'gemini-2.5-flash-native',
]);

export type OutputFieldType = 'number' | 'string' | 'boolean' | 'enum' | 'array' | 'object';

export interface OutputField {
  /** Field name as it appears in the agent's JSON output (e.g. "score") */
  name: string;
  type: OutputFieldType;
  /** Short description shown in autocomplete popovers */
  description?: string;
  /** For enum types, the allowed values */
  enumValues?: string[];
}

export interface LLMAgentConfig {
  role: string;
  model: ModelId;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  /** Reasoning-token allocation for models that support it (Gemini's
   * `thinking_budget`). Ignored for other providers. */
  thinkingBudget?: number;
  /**
   * Declared output schema. Downstream decision/loop nodes reference these
   * fields as `{{role.field}}` (e.g. `{{grader.score}} >= 0.8`).
   * This is what makes pipeline conditions resolvable rather than free text.
   */
  outputSchema?: OutputField[];
}

export interface ParallelConfig {
  numParallel: number;
  label?: string;
}

export interface AggregatorConfig {
  strategy: 'all' | 'best' | 'vote' | 'first' | 'concat';
  selectionCriteria?: string;
}

export interface DecisionConfig {
  condition: string;
  trueLabel: string;
  falseLabel: string;
}

export interface LoopConfig {
  maxIterations: number;
  breakCondition: string;
}

export interface HumanConfig {
  prompt: string;
  approvalRequired: boolean;
  timeoutSeconds?: number;
}

export interface ToolConfig {
  toolName: string;
  description: string;
  apiEndpoint?: string;
  inputSchema?: string;
  outputSchema?: string;
}

export interface NodeData {
  label: string;
  description?: string;
  agentConfig?: LLMAgentConfig;
  parallelConfig?: ParallelConfig;
  aggregatorConfig?: AggregatorConfig;
  decisionConfig?: DecisionConfig;
  loopConfig?: LoopConfig;
  humanConfig?: HumanConfig;
  toolConfig?: ToolConfig;
}

export type FlowNode = Node<NodeData, NodeKind>;
export type FlowEdge = Edge;

export interface Pipeline {
  id: string;
  name: string;
  description: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  createdAt: string;
  updatedAt: string;
}

export interface FormOption {
  label: string;
  value: string;
}

export interface FormQuestion {
  id: string;
  type: 'radio' | 'checkbox' | 'select' | 'text' | 'number';
  label: string;
  options?: FormOption[];
  placeholder?: string;
  min?: number;
  max?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  formQuestions?: FormQuestion[];
}

export type DesignerPhase = 'initial' | 'gathering' | 'generating' | 'ready';

export interface PipelineTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  pipeline: Pipeline;
}
