import type { Pipeline, PipelineTemplate, FlowEdge } from '@/types/pipeline';

const edge = (
  id: string,
  source: string,
  target: string,
  opts: Partial<FlowEdge> = {}
): FlowEdge => ({ id, source, target, ...opts });

// ─── Momus IMO Solver ─────────────────────────────────────────────────────────

const MOMUS: Pipeline = {
  id: 'momus-imo-solver',
  name: 'Momus IMO Solver',
  description:
    'Multi-agent iterative pipeline for solving International Mathematical Olympiad problems. Uses parallel solvers, grading, conjecture extraction, and a final synthesis step.',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  edges: [
    edge('e1', 'input', 'outerLoop'),
    edge('e2', 'outerLoop', 'parallelSolvers'),
    edge('e3', 'parallelSolvers', 'solver', { label: '× 4 instances', animated: true }),
    edge('e4', 'solver', 'grader'),
    edge('e5', 'grader', 'gradeDecision'),
    edge('e6', 'gradeDecision', 'conjectureExtractor', {
      sourceHandle: 'true',
      label: 'Threshold met',
      animated: true,
      style: { stroke: '#22c55e' },
    }),
    edge('e7', 'gradeDecision', 'parallelSolvers', {
      sourceHandle: 'false',
      label: 'Retry',
      animated: true,
      style: { stroke: '#f59e0b' },
    }),
    edge('e8', 'conjectureExtractor', 'parser'),
    edge('e9', 'parser', 'finalSolver'),
    edge('e10', 'finalSolver', 'output'),
  ],
  nodes: [
    { id: 'input', type: 'input', position: { x: 150, y: 40 }, data: { label: 'Math Problem', description: 'IMO competition problem statement' } },
    {
      id: 'outerLoop', type: 'loop', position: { x: 150, y: 160 },
      data: {
        label: 'Refinement Loop', description: 'Outer iteration over solve–grade cycle',
        loopConfig: { maxIterations: 3, breakCondition: '{{grader.score}} >= 0.95' },
      },
    },
    {
      id: 'parallelSolvers', type: 'parallel', position: { x: 150, y: 310 },
      data: {
        label: 'Parallel Solvers', description: 'K independent solution attempts',
        parallelConfig: { numParallel: 4, label: 'solvers' },
      },
    },
    {
      id: 'solver', type: 'llm_agent', position: { x: 150, y: 470 },
      data: {
        label: 'Solver Agent', description: 'Attempts a full proof of the problem',
        agentConfig: {
          role: 'solver', model: 'claude-sonnet-4-6', temperature: 0.7, maxTokens: 4096,
          systemPrompt: `You are a world-class mathematical problem solver specializing in International Mathematical Olympiad (IMO) competition problems.

Your task is to solve the given mathematical problem with complete rigor and clarity.

Guidelines:
- Begin with a clear problem analysis and identify key mathematical structures
- Explore multiple solution approaches before committing to one
- Present your solution step-by-step with rigorous justification
- Highlight non-obvious insights and verify edge cases

Output your solution in LaTeX-compatible mathematical notation.`,
        },
      },
    },
    {
      id: 'grader', type: 'llm_agent', position: { x: 150, y: 640 },
      data: {
        label: 'Grader Agent', description: 'Evaluates solution correctness and rigor',
        agentConfig: {
          role: 'grader', model: 'claude-sonnet-4-6', temperature: 0.2, maxTokens: 1024,
          systemPrompt: `You are a rigorous mathematical solution evaluator for IMO-level competition mathematics.

Evaluate the provided solution on:
- Correctness: Is the mathematical reasoning valid?
- Completeness: Are all cases handled?
- Rigor: Are all steps justified?
- Insight: Is there deep mathematical understanding?

Return JSON: { "score": float (0-1), "verdict": "correct"|"partial"|"incorrect", "feedback": string, "key_insights": string[], "missing_steps": string[] }`,
          outputSchema: [
            { name: 'score', type: 'number', description: 'Overall quality score in [0, 1]' },
            { name: 'verdict', type: 'enum', description: 'Categorical judgment', enumValues: ['correct', 'partial', 'incorrect'] },
            { name: 'feedback', type: 'string', description: 'Free-form written critique' },
            { name: 'key_insights', type: 'array', description: 'List of identified insights' },
            { name: 'missing_steps', type: 'array', description: 'List of steps not yet justified' },
          ],
        },
      },
    },
    {
      id: 'gradeDecision', type: 'decision', position: { x: 150, y: 810 },
      data: {
        label: 'Grade Check', description: 'Has the solution reached the quality threshold?',
        decisionConfig: { condition: '{{grader.score}} >= 0.8', trueLabel: 'Threshold Met', falseLabel: 'Retry' },
      },
    },
    {
      id: 'conjectureExtractor', type: 'llm_agent', position: { x: 530, y: 960 },
      data: {
        label: 'Conjecture Extractor', description: 'Synthesizes key insights from all partial solutions',
        agentConfig: {
          role: 'conjecture_extractor', model: 'claude-opus-4-7', temperature: 0.5, maxTokens: 2048,
          systemPrompt: `You are a mathematical insight synthesizer. Given multiple solution attempts at varying levels of completeness, extract the most promising conjectures, lemmas, and key ideas.

For each insight:
- State it precisely in mathematical terms
- Cite supporting evidence from solution attempts
- Rate confidence (high/medium/low)
- Explain how it could contribute to a complete proof

Prioritize insights appearing across multiple attempts or representing genuine mathematical depth.`,
        },
      },
    },
    {
      id: 'parser', type: 'llm_agent', position: { x: 530, y: 1130 },
      data: {
        label: 'Parser Agent', description: 'Formats and deduplicates extracted conjectures',
        agentConfig: {
          role: 'parser', model: 'claude-haiku-4-5-20251001', temperature: 0.1, maxTokens: 1024,
          systemPrompt: `You are a mathematical content formatter. Transform raw extracted conjectures into a clean, structured document:

1. Organize insights by mathematical relevance
2. Remove duplicates
3. State each insight with proper mathematical notation
4. Order from foundational to advanced

Output: clean markdown with LaTeX math expressions.`,
        },
      },
    },
    {
      id: 'finalSolver', type: 'llm_agent', position: { x: 530, y: 1300 },
      data: {
        label: 'Final Solver', description: 'Synthesizes all insights into a complete proof',
        agentConfig: {
          role: 'final_solver', model: 'claude-opus-4-7', temperature: 0.5, maxTokens: 8192,
          systemPrompt: `You are a master mathematician synthesizing insights into a complete IMO solution.

You have:
- The original problem statement
- Curated conjectures and lemmas from prior solution attempts

Your task: Produce the definitive, complete, elegant solution by selecting the most promising approach, filling in missing steps, and writing a rigorous proof that meets IMO standards.`,
        },
      },
    },
    { id: 'output', type: 'output', position: { x: 530, y: 1460 }, data: { label: 'Final Solution', description: 'Complete, rigorous mathematical proof' } },
  ],
};

// ─── Generate–Critique–Refine ─────────────────────────────────────────────────

const GCR: Pipeline = {
  id: 'generate-critique-refine',
  name: 'Generate → Critique → Refine',
  description:
    'A classic iterative refinement loop: a Generator produces a draft, a Critic evaluates it, and a Refiner improves it until a quality threshold is reached.',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  edges: [
    edge('e1', 'input', 'generator'),
    edge('e2', 'generator', 'loop'),
    edge('e3', 'loop', 'critic'),
    edge('e4', 'critic', 'qualityCheck'),
    edge('e5', 'qualityCheck', 'output', {
      sourceHandle: 'true', label: 'Quality OK',
      animated: true, style: { stroke: '#22c55e' },
    }),
    edge('e6', 'qualityCheck', 'refiner', {
      sourceHandle: 'false', label: 'Needs work',
      animated: true, style: { stroke: '#f59e0b' },
    }),
    edge('e7', 'refiner', 'critic', { label: 'revised draft', animated: true }),
  ],
  nodes: [
    { id: 'input', type: 'input', position: { x: 250, y: 40 }, data: { label: 'Input', description: 'Initial task or problem' } },
    {
      id: 'generator', type: 'llm_agent', position: { x: 250, y: 160 },
      data: {
        label: 'Generator', description: 'Produces an initial response or draft',
        agentConfig: {
          role: 'generator', model: 'claude-sonnet-4-6', temperature: 0.8, maxTokens: 2048,
          systemPrompt: 'You are a creative problem solver. Generate a thorough, well-structured initial response to the given task. Be comprehensive and explore the problem space fully.',
        },
      },
    },
    {
      id: 'loop', type: 'loop', position: { x: 250, y: 320 },
      data: {
        label: 'Refinement Loop', description: 'Iterate until quality threshold met',
        loopConfig: { maxIterations: 5, breakCondition: '{{critic.score}} >= 0.85' },
      },
    },
    {
      id: 'critic', type: 'llm_agent', position: { x: 250, y: 470 },
      data: {
        label: 'Critic', description: 'Evaluates the response and identifies weaknesses',
        agentConfig: {
          role: 'critic', model: 'claude-sonnet-4-6', temperature: 0.3, maxTokens: 1024,
          systemPrompt: 'You are a rigorous critic. Evaluate the provided response for accuracy, completeness, clarity, and quality. Return JSON: { "score": float (0-1), "strengths": string[], "weaknesses": string[], "suggestions": string[] }',
          outputSchema: [
            { name: 'score', type: 'number', description: 'Overall quality score in [0, 1]' },
            { name: 'strengths', type: 'array', description: 'Things the draft does well' },
            { name: 'weaknesses', type: 'array', description: 'Problems in the draft' },
            { name: 'suggestions', type: 'array', description: 'Concrete improvement suggestions' },
          ],
        },
      },
    },
    {
      id: 'qualityCheck', type: 'decision', position: { x: 250, y: 630 },
      data: {
        label: 'Quality Gate', description: 'Is the response good enough?',
        decisionConfig: { condition: '{{critic.score}} >= 0.85', trueLabel: 'Approved', falseLabel: 'Revise' },
      },
    },
    {
      id: 'refiner', type: 'llm_agent', position: { x: 620, y: 630 },
      data: {
        label: 'Refiner', description: 'Improves the response based on critique',
        agentConfig: {
          role: 'refiner', model: 'claude-sonnet-4-6', temperature: 0.5, maxTokens: 2048,
          systemPrompt: 'You are an expert editor and refiner. Given the original response and the critic\'s feedback, produce an improved version that addresses all weaknesses while preserving strengths. Be precise and purposeful in your revisions.',
        },
      },
    },
    { id: 'output', type: 'output', position: { x: 250, y: 790 }, data: { label: 'Final Response', description: 'Quality-approved output' } },
  ],
};

// ─── Parallel-and-Distill ────────────────────────────────────────────────────

const PAD: Pipeline = {
  id: 'parallel-and-distill',
  name: 'Parallel Solve → Distill → Refine',
  description:
    'Generate N independent solutions in parallel, rank and distill the best insights, then refine into a single high-quality answer.',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  edges: [
    edge('e1', 'input', 'fanOut'),
    edge('e2', 'fanOut', 'solver', { label: '× N instances', animated: true }),
    edge('e3', 'solver', 'collector'),
    edge('e4', 'collector', 'ranker'),
    edge('e5', 'ranker', 'refiner'),
    edge('e6', 'refiner', 'output'),
  ],
  nodes: [
    { id: 'input', type: 'input', position: { x: 250, y: 40 }, data: { label: 'Input', description: 'Problem or task' } },
    {
      id: 'fanOut', type: 'parallel', position: { x: 250, y: 160 },
      data: {
        label: 'Parallel Fan-out', description: 'Spawn N independent solvers',
        parallelConfig: { numParallel: 5, label: 'independent solvers' },
      },
    },
    {
      id: 'solver', type: 'llm_agent', position: { x: 250, y: 320 },
      data: {
        label: 'Solution Generator', description: 'One of N independent solution attempts',
        agentConfig: {
          role: 'solver', model: 'claude-sonnet-4-6', temperature: 0.9, maxTokens: 2048,
          systemPrompt: 'You are an independent problem solver. Generate a creative, thorough solution to the given problem. Be unique — explore different angles and approaches than you might normally take.',
        },
      },
    },
    {
      id: 'collector', type: 'aggregator', position: { x: 250, y: 480 },
      data: {
        label: 'Collect All', description: 'Gather all N solutions',
        aggregatorConfig: { strategy: 'all' },
      },
    },
    {
      id: 'ranker', type: 'llm_agent', position: { x: 250, y: 640 },
      data: {
        label: 'Ranker / Distiller', description: 'Ranks solutions and extracts the best insights',
        agentConfig: {
          role: 'ranker', model: 'claude-opus-4-7', temperature: 0.3, maxTokens: 2048,
          systemPrompt: 'You are an expert evaluator. Given N candidate solutions, rank them by quality and extract the key insights, approaches, and reasoning from the top solutions. Synthesize these into a structured summary of the best ideas.',
        },
      },
    },
    {
      id: 'refiner', type: 'llm_agent', position: { x: 250, y: 800 },
      data: {
        label: 'Synthesizer', description: 'Combines top insights into a single polished answer',
        agentConfig: {
          role: 'synthesizer', model: 'claude-opus-4-7', temperature: 0.4, maxTokens: 4096,
          systemPrompt: 'You are a master synthesizer. Given the ranked solutions and extracted insights, produce a single, definitive, high-quality answer that combines the best elements from all approaches. The result should be better than any individual solution.',
        },
      },
    },
    { id: 'output', type: 'output', position: { x: 250, y: 960 }, data: { label: 'Best Answer', description: 'Synthesized from N parallel attempts' } },
  ],
};

// ─── Divide and Conquer ───────────────────────────────────────────────────────

const DAC: Pipeline = {
  id: 'divide-and-conquer',
  name: 'Divide and Conquer',
  description:
    'Decompose a complex problem into independent sub-problems, solve each in parallel, then merge the results into a unified solution.',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  edges: [
    edge('e1', 'input', 'decomposer'),
    edge('e2', 'decomposer', 'fanOut'),
    edge('e3', 'fanOut', 'subSolver', { label: '× sub-problems', animated: true }),
    edge('e4', 'subSolver', 'collector'),
    edge('e5', 'collector', 'synthesizer'),
    edge('e6', 'synthesizer', 'output'),
  ],
  nodes: [
    { id: 'input', type: 'input', position: { x: 250, y: 40 }, data: { label: 'Complex Problem', description: 'Input requiring decomposition' } },
    {
      id: 'decomposer', type: 'llm_agent', position: { x: 250, y: 160 },
      data: {
        label: 'Problem Decomposer', description: 'Breaks the problem into independent sub-tasks',
        agentConfig: {
          role: 'decomposer', model: 'claude-opus-4-7', temperature: 0.4, maxTokens: 1024,
          systemPrompt: 'You are a strategic problem decomposer. Break the given complex problem into a set of independent, well-defined sub-problems that can be solved in parallel. For each sub-problem provide: a clear title, a precise description, the relevant context, and the expected output format.',
        },
      },
    },
    {
      id: 'fanOut', type: 'parallel', position: { x: 250, y: 320 },
      data: {
        label: 'Sub-problem Fan-out', description: 'Distribute sub-problems to parallel solvers',
        parallelConfig: { numParallel: 4, label: 'sub-problems' },
      },
    },
    {
      id: 'subSolver', type: 'llm_agent', position: { x: 250, y: 480 },
      data: {
        label: 'Sub-problem Solver', description: 'Solves one independent sub-problem',
        agentConfig: {
          role: 'sub_solver', model: 'claude-sonnet-4-6', temperature: 0.6, maxTokens: 2048,
          systemPrompt: 'You are a focused problem solver. You will receive one specific sub-problem to solve. Provide a complete, correct, and well-justified solution. Stay focused on only this sub-problem.',
        },
      },
    },
    {
      id: 'collector', type: 'aggregator', position: { x: 250, y: 640 },
      data: {
        label: 'Collect Sub-solutions', description: 'Gather results from all sub-problem solvers',
        aggregatorConfig: { strategy: 'all' },
      },
    },
    {
      id: 'synthesizer', type: 'llm_agent', position: { x: 250, y: 800 },
      data: {
        label: 'Solution Synthesizer', description: 'Merges sub-solutions into a unified answer',
        agentConfig: {
          role: 'synthesizer', model: 'claude-opus-4-7', temperature: 0.4, maxTokens: 4096,
          systemPrompt: 'You are a master synthesizer. Given solutions to each sub-problem, integrate them into a single coherent, unified solution to the original problem. Resolve any inconsistencies between sub-solutions and ensure the combined result is complete and internally consistent.',
        },
      },
    },
    { id: 'output', type: 'output', position: { x: 250, y: 960 }, data: { label: 'Unified Solution', description: 'Merged result from all sub-problems' } },
  ],
};

// ─── Map-Reduce ─────────────────────────────────────────────────────────────

const MAP_REDUCE: Pipeline = {
  id: 'map-reduce',
  name: 'Map-Reduce',
  description:
    'Split an input into chunks, map each chunk through an LLM agent in parallel, then reduce/aggregate the results into a single coherent output.',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  edges: [
    edge('e1', 'input', 'splitter'),
    edge('e2', 'splitter', 'fanOut'),
    edge('e3', 'fanOut', 'mapper', { label: '× chunks', animated: true }),
    edge('e4', 'mapper', 'collector'),
    edge('e5', 'collector', 'reducer'),
    edge('e6', 'reducer', 'qualityCheck'),
    edge('e7', 'qualityCheck', 'output', {
      sourceHandle: 'true', label: 'Complete',
      animated: true, style: { stroke: '#22c55e' },
    }),
    edge('e8', 'qualityCheck', 'reducer', {
      sourceHandle: 'false', label: 'Gaps found',
      animated: true, style: { stroke: '#f59e0b' },
    }),
  ],
  nodes: [
    { id: 'input', type: 'input', position: { x: 250, y: 40 }, data: { label: 'Input Document', description: 'Large text, dataset, or multi-part input' } },
    {
      id: 'splitter', type: 'llm_agent', position: { x: 250, y: 160 },
      data: {
        label: 'Chunk Splitter', description: 'Splits input into independent chunks for parallel processing',
        agentConfig: {
          role: 'splitter', model: 'claude-haiku-4-5-20251001', temperature: 0.1, maxTokens: 1024,
          systemPrompt: 'You are a document chunking specialist. Split the given input into logical, self-contained chunks that can be processed independently. Output a JSON array of chunks, each with a "chunk_id" and "content" field. Ensure no important context is lost at chunk boundaries.',
        },
      },
    },
    {
      id: 'fanOut', type: 'parallel', position: { x: 250, y: 320 },
      data: {
        label: 'Map Fan-out', description: 'Distribute chunks to parallel mappers',
        parallelConfig: { numParallel: 8, label: 'chunk processors' },
      },
    },
    {
      id: 'mapper', type: 'llm_agent', position: { x: 250, y: 480 },
      data: {
        label: 'Mapper Agent', description: 'Processes a single chunk — extract, transform, or analyze',
        agentConfig: {
          role: 'mapper', model: 'claude-sonnet-4-6', temperature: 0.3, maxTokens: 2048,
          systemPrompt: 'You are a focused data processor. Given one chunk of a larger document, perform the requested analysis or transformation on this chunk alone. Output structured JSON with your results. Be thorough but stay within the scope of your assigned chunk.',
        },
      },
    },
    {
      id: 'collector', type: 'aggregator', position: { x: 250, y: 640 },
      data: {
        label: 'Collect Map Results', description: 'Gather all mapper outputs',
        aggregatorConfig: { strategy: 'all' },
      },
    },
    {
      id: 'reducer', type: 'llm_agent', position: { x: 250, y: 800 },
      data: {
        label: 'Reducer Agent', description: 'Merges all chunk results into a single coherent output',
        agentConfig: {
          role: 'reducer', model: 'claude-opus-4-7', temperature: 0.4, maxTokens: 4096,
          systemPrompt: `You are a master synthesizer and data reducer. Given the mapped results from multiple chunks, combine them into a single, coherent, comprehensive output. Resolve any contradictions between chunks, eliminate redundancy, and ensure the final result reads as if it were produced from the original input as a whole.

After producing the merged result, also report self-assessment metadata:
- coverage: fraction of source chunks accounted for (0-1)
- contradictions: boolean — whether any unresolved contradictions remain

Return JSON: { "output": string, "coverage": float, "contradictions": boolean }`,
          outputSchema: [
            { name: 'output', type: 'string', description: 'Merged reduced result' },
            { name: 'coverage', type: 'number', description: 'Fraction of input chunks represented in the output' },
            { name: 'contradictions', type: 'boolean', description: 'True if unresolved contradictions remain' },
          ],
        },
      },
    },
    {
      id: 'qualityCheck', type: 'decision', position: { x: 250, y: 960 },
      data: {
        label: 'Completeness Check', description: 'Are all chunks accounted for and consistent?',
        decisionConfig: {
          condition: '{{reducer.coverage}} >= 0.95 && !{{reducer.contradictions}}',
          trueLabel: 'Complete',
          falseLabel: 'Gaps Found',
        },
      },
    },
    { id: 'output', type: 'output', position: { x: 250, y: 1120 }, data: { label: 'Reduced Output', description: 'Final merged result from all chunks' } },
  ],
};

export const TEMPLATES: PipelineTemplate[] = [
  { id: 'momus', name: 'Momus IMO Solver', description: 'Multi-agent iterative pipeline for competition mathematics', category: 'Research', pipeline: MOMUS },
  { id: 'generate-critique-refine', name: 'Generate → Critique → Refine', description: 'Iterative quality-improvement loop', category: 'Quality', pipeline: GCR },
  { id: 'parallel-and-distill', name: 'Parallel Solve → Distill', description: 'N parallel solvers distilled into one best answer', category: 'Parallel', pipeline: PAD },
  { id: 'divide-and-conquer', name: 'Divide and Conquer', description: 'Decompose, solve in parallel, synthesize', category: 'Parallel', pipeline: DAC },
  { id: 'map-reduce', name: 'Map-Reduce', description: 'Split → map in parallel → reduce to single output', category: 'Data', pipeline: MAP_REDUCE },
];

export function getTemplate(id: string): PipelineTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
