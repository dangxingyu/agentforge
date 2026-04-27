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

// NB: model IDs and provider routing live in `lib/models.ts` +
// `lib/providers/`. The old `ModelId` union / `MODEL_LABELS` /
// `MODEL_PROVIDERS` / `MODELS_WITH_THINKING` exports were removed in
// favor of that registry. `LLMAgentConfig.model` is now a free-form
// `string` so adding models doesn't require a type-rebuild and so
// custom OpenRouter slugs (`or:provider/slug`) round-trip cleanly.

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
  /** Model id from `lib/models.ts`'s registry, OR a custom OpenRouter
   * slug prefixed with `or:` (added by users in Settings). Free-form
   * string so future-added models don't require a type-check rebuild. */
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  /** Reasoning-token allocation for models that support it (Anthropic
   * extended thinking, Gemini reasoning, OpenAI o-series). Ignored for
   * providers that don't support it. */
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

/**
 * Configuration for a consecutive counter tracked by a loop node.
 * On each re-entry, the loop evaluates `condition` against the current context.
 * If true, `consecutiveTrue` increments and `consecutiveFalse` resets to 0 (and vice versa).
 * The counter values are exposed in context as `{{loopRole.consecutiveTrue}}` and
 * `{{loopRole.consecutiveFalse}}` (or custom names if `trueName`/`falseName` are set).
 *
 * This models the Huang-Yang verification pattern where 5 consecutive successes = SOLVED
 * and 10 consecutive failures = GIVE UP, with each outcome resetting the other counter.
 */
export interface LoopCounterConfig {
  /** Expression to evaluate each iteration (e.g. `{{bug_analyzer.verdict}} == "yes"`) */
  condition: string;
  /** Context variable name for the consecutive-true count (default: "consecutiveTrue") */
  trueName?: string;
  /** Context variable name for the consecutive-false count (default: "consecutiveFalse") */
  falseName?: string;
  /** Initial value for the consecutive-false counter (e.g. 1 for incomplete-solution penalty) */
  initialFalse?: number;
}

export interface LoopConfig {
  maxIterations: number;
  breakCondition: string;
  /** Optional consecutive counter — tracked per iteration, exposed in context. */
  counter?: LoopCounterConfig;
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
