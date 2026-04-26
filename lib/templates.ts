import type { Pipeline, PipelineTemplate, FlowEdge } from '@/types/pipeline';
import {
  SOLVER_PROMPT,
  GRADER_PROMPT,
  CONJECTURE_EXTRACTOR_PROMPT,
  CONJECTURE_PARSER_PROMPT,
  QUALITY_CHECKER_PROMPT,
} from './templates/momusPrompts';

const edge = (
  id: string,
  source: string,
  target: string,
  opts: Partial<FlowEdge> = {}
): FlowEdge => ({ id, source, target, ...opts });

// ─── Momus IMO Solver ─────────────────────────────────────────────────────────

// Faithfully mirrors the real Momus pipeline at github.com/princeton-pli/momus-imo-solver.
//
// Phase 1 — Solver-Grader Loop (Steps 1-5):
//   K=4 parallel solvers → grade each → pick highest-scoring →
//   if grade >= 5: proceed; else loop back via feedback injection
//   (max_solver_grader_rounds = 2)
// Outer loop (Phase 2 + Phase 3, max_outer_loops = 3):
//   Phase 2 — Extraction & Recursive Verification (Steps 6-8):
//     conjecture_extractor → conjecture_parser → quality_checker →
//     recursive verifier (proves each conjecture, accumulates lemmas)
//   Phase 3 — Integration & Final Solving (Steps 9-11):
//     K=5 final solvers (with proven lemmas) → grade → pick best →
//     if grade == 7: Rule 2 verification; else loop back to Phase 2
// Rule 2 — Triple-grader verification of perfect scores
//
// All system prompts are copied verbatim from imo_solver/prompts/momus_prompts.yaml
// (with a small JSON tail appended on the grader/extractor for AgentForge runtime).
// All model IDs, temperatures, max_tokens, and thinking_budgets match
// imo_solver/config/momus_config.yaml exactly.

const MOMUS: Pipeline = {
  id: 'momus-imo-solver',
  name: 'Momus IMO Solver',
  description:
    'Princeton-PLI Momus pipeline: dialectic solving + Council-of-Graders evaluation, with feedback injection, conjecture extraction & recursive verification, final lemma-augmented solving, and Rule 2 triple verification of perfect scores. Uses Gemini 2.5 Pro/Flash native-thinking models throughout.',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  edges: [
    // Phase 1 — Solver-Grader Loop
    edge('e1', 'input', 'phase1Loop'),
    edge('e2', 'phase1Loop', 'parallelSolvers'),
    edge('e3', 'parallelSolvers', 'solver', { animated: true }),
    edge('e4', 'solver', 'grader'),
    edge('e5', 'grader', 'bestSolverP1'),
    edge('e6', 'bestSolverP1', 'phase1Decision'),
    edge('e7', 'phase1Decision', 'outerLoop', {
      sourceHandle: 'true',
      label: 'grade ≥ 5',
      animated: true,
      style: { stroke: '#16a34a' },
    }),
    edge('e8', 'phase1Decision', 'parallelSolvers', {
      sourceHandle: 'false',
      label: 'feedback injection',
      animated: true,
      style: { stroke: '#d97706' },
    }),

    // Outer loop entry → Phase 2
    edge('e9', 'outerLoop', 'conjectureExtractor'),

    // Phase 2 — Extraction & Verification
    edge('e10', 'conjectureExtractor', 'conjectureParser'),
    edge('e11', 'conjectureParser', 'qualityChecker'),
    edge('e12', 'qualityChecker', 'recursiveVerifier'),

    // Phase 3 — Final solving
    edge('e13', 'recursiveVerifier', 'finalParallelSolvers'),
    edge('e14', 'finalParallelSolvers', 'finalSolver', { animated: true }),
    edge('e15', 'finalSolver', 'finalGrader'),
    edge('e16', 'finalGrader', 'finalBestPick'),
    edge('e17', 'finalBestPick', 'finalDecision'),

    edge('e18', 'finalDecision', 'rule2Parallel', {
      sourceHandle: 'true',
      label: 'grade == 7',
      animated: true,
      style: { stroke: '#16a34a' },
    }),
    edge('e19', 'finalDecision', 'outerLoop', {
      sourceHandle: 'false',
      label: 'next outer iter.',
      animated: true,
      style: { stroke: '#d97706' },
    }),

    // Rule 2 — Triple verification
    edge('e20', 'rule2Parallel', 'rule2Grader', { animated: true }),
    edge('e21', 'rule2Grader', 'rule2Vote'),
    edge('e22', 'rule2Vote', 'ruleCheck'),
    edge('e23', 'ruleCheck', 'output', {
      sourceHandle: 'true',
      label: 'unanimous 7/7',
      animated: true,
      style: { stroke: '#16a34a' },
    }),
    edge('e24', 'ruleCheck', 'outerLoop', {
      sourceHandle: 'false',
      label: 'verification failed',
      animated: true,
      style: { stroke: '#d97706' },
    }),
  ],
  nodes: [
    {
      id: 'input', type: 'input', position: { x: 200, y: 40 },
      data: { label: 'Math Problem', description: 'IMO competition problem statement' },
    },

    // ── Phase 1 ──────────────────────────────────────────────────────────
    {
      id: 'phase1Loop', type: 'loop', position: { x: 200, y: 160 },
      data: {
        label: 'Phase 1 · Solver-Grader Loop',
        description: 'Steps 1-5. max_solver_grader_rounds = 2. Exit when max grade ≥ min_grade_for_phase2 (5).',
        loopConfig: { maxIterations: 2, breakCondition: '{{grader.grade}} >= 5' },
      },
    },
    {
      id: 'parallelSolvers', type: 'parallel', position: { x: 200, y: 310 },
      data: {
        label: 'Parallel Solvers',
        description: 'Step 1: K=4 parallel initial-solving sessions (num_parallel_solvers).',
        parallelConfig: { numParallel: 4, label: 'solver sessions' },
      },
    },
    {
      id: 'solver', type: 'llm_agent', position: { x: 200, y: 470 },
      data: {
        label: 'Solver (Dialectic Engine)',
        description: 'Council of Architects + Momus + Veritas + Chief Architect. Multi-persona dialectic with lazy-semantics censor and gauntlet critique.',
        agentConfig: {
          role: 'solver',
          model: 'gemini-2.5-pro-native',
          temperature: 0.6,
          maxTokens: 65536,
          thinkingBudget: 32768,
          systemPrompt: SOLVER_PROMPT,
        },
      },
    },
    {
      id: 'grader', type: 'llm_agent', position: { x: 200, y: 640 },
      data: {
        label: 'Grader (Inquisitorial Logic)',
        description: 'Step 2: Council of Graders — Inquisitor + Architect + Advocatus Diaboli + Chief Grader. Outputs Final Grade on 0-7 scale (5 disallowed).',
        agentConfig: {
          role: 'grader',
          model: 'gemini-2.5-pro-native',
          temperature: 0.1,
          maxTokens: 65536,
          thinkingBudget: 32768,
          systemPrompt: GRADER_PROMPT,
          outputSchema: [
            { name: 'grade', type: 'number', description: 'Final grade on 0-7 scale (5 disallowed by rubric)' },
            { name: 'verdict', type: 'string', description: 'One-sentence summary' },
            { name: 'areas_for_improvement', type: 'array', description: 'List of slips & fallacies' },
            { name: 'scaffolding_questions', type: 'array', description: '3-5 questions building intuition for missing concepts' },
          ],
        },
      },
    },
    {
      id: 'bestSolverP1', type: 'aggregator', position: { x: 200, y: 810 },
      data: {
        label: 'Pick Best of K',
        description: 'From the 4 parallel solver-grader pairs, keep the one with the highest grade.',
        aggregatorConfig: { strategy: 'best', selectionCriteria: '{{grader.grade}}' },
      },
    },
    {
      id: 'phase1Decision', type: 'decision', position: { x: 200, y: 950 },
      data: {
        label: 'Phase 1 Gate',
        description: 'Step 5 early-exit check. ≥5 proceeds; else inject grader feedback into solver sessions and re-run (Step 3 + 4).',
        decisionConfig: { condition: '{{grader.grade}} >= 5', trueLabel: 'Proceed', falseLabel: 'Inject feedback' },
      },
    },

    // ── Outer loop (Phase 2 + 3) ─────────────────────────────────────────
    {
      id: 'outerLoop', type: 'loop', position: { x: 600, y: 160 },
      data: {
        label: 'Outer Loop · Phase 2 + 3',
        description: 'max_outer_loops = 3. Iterate Phase 2 + Phase 3, accumulating proven lemmas across iterations. Exit on perfect score (verified by Rule 2).',
        loopConfig: { maxIterations: 3, breakCondition: '{{finalGrader.grade}} == 7' },
      },
    },

    // ── Phase 2: Extraction & Verification ───────────────────────────────
    {
      id: 'conjectureExtractor', type: 'llm_agent', position: { x: 600, y: 310 },
      data: {
        label: 'Conjecture Extractor',
        description: 'Step 6: From top num_top_solutions=2 partial proofs, extract a minimal set of self-contained conjectures whose proof would close the gaps.',
        agentConfig: {
          role: 'conjecture_extractor',
          model: 'gemini-2.5-pro-native',
          temperature: 0.3,
          maxTokens: 65536,
          thinkingBudget: 32768,
          systemPrompt: CONJECTURE_EXTRACTOR_PROMPT,
          outputSchema: [
            { name: 'conjectures', type: 'array', description: 'Self-contained mathematical statements' },
            { name: 'negations', type: 'array', description: 'Negation of each conjecture' },
            { name: 'proof', type: 'string', description: 'Rigorous proof assuming the conjectures' },
          ],
        },
      },
    },
    {
      id: 'conjectureParser', type: 'llm_agent', position: { x: 600, y: 480 },
      data: {
        label: 'Conjecture Parser',
        description: 'Lightweight Flash parse pass: re-extract conjectures, negations, and proof into strict JSON for downstream consumption.',
        agentConfig: {
          role: 'conjecture_parser',
          model: 'gemini-2.5-flash-native',
          temperature: 0.0,
          maxTokens: 16384,
          systemPrompt: CONJECTURE_PARSER_PROMPT,
          outputSchema: [
            { name: 'conjectures', type: 'array' },
            { name: 'negations', type: 'array' },
            { name: 'proof', type: 'string' },
          ],
        },
      },
    },
    {
      id: 'qualityChecker', type: 'llm_agent', position: { x: 600, y: 640 },
      data: {
        label: 'Quality Checker',
        description: 'Step 7: For each (conjecture, negation) pair, verify both are fully self-contained (no references to original problem context).',
        agentConfig: {
          role: 'quality_checker',
          model: 'gemini-2.5-flash-native',
          temperature: 0.0,
          maxTokens: 8192,
          systemPrompt: QUALITY_CHECKER_PROMPT,
          outputSchema: [
            { name: 'verdict', type: 'enum', description: 'PASS or FAIL', enumValues: ['PASS', 'FAIL'] },
            { name: 'reason', type: 'string' },
          ],
        },
      },
    },
    {
      id: 'recursiveVerifier', type: 'llm_agent', position: { x: 600, y: 800 },
      data: {
        label: 'Recursive Verifier',
        description: 'Step 8: Batch-solve each validated conjecture (and its negation) via a fresh solver+grader sub-pipeline, accumulate those graded ≥ conjecture_grade_threshold (5) as proven lemmas.',
        agentConfig: {
          role: 'recursive_verifier',
          model: 'gemini-2.5-pro-native',
          temperature: 0.6,
          maxTokens: 65536,
          thinkingBudget: 32768,
          systemPrompt:
            "You are a recursive verifier. For each conjecture passed in, run a fresh dialectic solver + Council-of-Graders cycle in parallel. Accept the conjecture as a proven lemma only if its grade reaches the conjecture_grade_threshold AND its negation cannot be proven. Output the list of proven lemmas as JSON: {\"proven_lemmas\": [{\"conjecture\": str, \"proof\": str, \"grade\": int}]}.",
          outputSchema: [
            { name: 'proven_lemmas', type: 'array', description: 'List of {conjecture, proof, grade} entries that passed verification' },
          ],
        },
      },
    },

    // ── Phase 3: Final Solving ──────────────────────────────────────────
    {
      id: 'finalParallelSolvers', type: 'parallel', position: { x: 600, y: 970 },
      data: {
        label: 'Final Parallel Solvers',
        description: 'Step 10: num_final_parallel_solvers = 5. Solve the original problem assuming all proven lemmas plus references to previous solutions.',
        parallelConfig: { numParallel: 5, label: 'lemma-augmented solvers' },
      },
    },
    {
      id: 'finalSolver', type: 'llm_agent', position: { x: 600, y: 1130 },
      data: {
        label: 'Final Solver',
        description: 'Same dialectic engine as Phase 1, but now with proven lemmas as Additional Materials (no longer "unverified hints").',
        agentConfig: {
          role: 'solver',
          model: 'gemini-2.5-pro-native',
          temperature: 0.6,
          maxTokens: 65536,
          thinkingBudget: 32768,
          systemPrompt: SOLVER_PROMPT,
        },
      },
    },
    {
      id: 'finalGrader', type: 'llm_agent', position: { x: 600, y: 1300 },
      data: {
        label: 'Final Grader',
        description: 'Step 11: Same Council-of-Graders rubric as Phase 1, applied to the final lemma-augmented solutions.',
        agentConfig: {
          role: 'final_grader',
          model: 'gemini-2.5-pro-native',
          temperature: 0.1,
          maxTokens: 65536,
          thinkingBudget: 32768,
          systemPrompt: GRADER_PROMPT,
          outputSchema: [
            { name: 'grade', type: 'number', description: '0-7 scale' },
            { name: 'verdict', type: 'string' },
            { name: 'areas_for_improvement', type: 'array' },
            { name: 'scaffolding_questions', type: 'array' },
          ],
        },
      },
    },
    {
      id: 'finalBestPick', type: 'aggregator', position: { x: 600, y: 1470 },
      data: {
        label: 'Pick Best Final',
        description: 'From the 5 lemma-augmented solver-grader pairs, keep the highest-graded one.',
        aggregatorConfig: { strategy: 'best', selectionCriteria: '{{final_grader.grade}}' },
      },
    },
    {
      id: 'finalDecision', type: 'decision', position: { x: 600, y: 1610 },
      data: {
        label: 'Perfect Score?',
        description: 'success_threshold = 7. Only a perfect 7/7 triggers Rule 2 verification; anything less goes back through the outer loop with the new lemmas accumulated.',
        decisionConfig: { condition: '{{final_grader.grade}} == 7', trueLabel: 'Verify', falseLabel: 'Iterate' },
      },
    },

    // ── Rule 2: Triple Verification ─────────────────────────────────────
    {
      id: 'rule2Parallel', type: 'parallel', position: { x: 1000, y: 1610 },
      data: {
        label: 'Rule 2 · Triple Verification',
        description: 'rule2_verification_count = 3 independent grader sessions, each freshly seeing the candidate solution.',
        parallelConfig: { numParallel: 3, label: 'independent verifiers' },
      },
    },
    {
      id: 'rule2Grader', type: 'llm_agent', position: { x: 1000, y: 1770 },
      data: {
        label: 'Rule 2 Grader',
        description: 'Re-grades from scratch with no shared context across the 3 verifiers — each must independently arrive at 7/7.',
        agentConfig: {
          role: 'rule2_grader',
          model: 'gemini-2.5-pro-native',
          temperature: 0.1,
          maxTokens: 65536,
          thinkingBudget: 32768,
          systemPrompt: GRADER_PROMPT,
          outputSchema: [
            { name: 'grade', type: 'number', description: '0-7 scale' },
            { name: 'verdict', type: 'string' },
            { name: 'areas_for_improvement', type: 'array' },
            { name: 'scaffolding_questions', type: 'array' },
          ],
        },
      },
    },
    {
      id: 'rule2Vote', type: 'aggregator', position: { x: 1000, y: 1940 },
      data: {
        label: 'Vote on Grade',
        description: 'Majority vote on the verifiers\' grades. Real Momus requires ALL three to give 7/7 (this template uses majority — tighten by inspecting individual outputs in the runtime).',
        aggregatorConfig: { strategy: 'vote', selectionCriteria: '{{rule2_grader.grade}}' },
      },
    },
    {
      id: 'ruleCheck', type: 'decision', position: { x: 1000, y: 2080 },
      data: {
        label: 'Unanimous 7/7?',
        description: 'Rule 2: only succeed if the majority verifier vote is 7/7. Otherwise the candidate is treated as a high-quality but unverified solution and the outer loop continues.',
        decisionConfig: { condition: '{{rule2_grader.grade}} == 7', trueLabel: 'SUCCESS', falseLabel: 'Continue iter.' },
      },
    },

    {
      id: 'output', type: 'output', position: { x: 1000, y: 2220 },
      data: { label: 'Verified Solution', description: 'Final IMO solution with Rule 2 triple-verified perfect grade.' },
    },
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
      animated: true, style: { stroke: '#16a34a' },
    }),
    edge('e6', 'qualityCheck', 'refiner', {
      sourceHandle: 'false', label: 'Needs work',
      animated: true, style: { stroke: '#d97706' },
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
    edge('e2', 'fanOut', 'solver', { animated: true }),
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
    edge('e3', 'fanOut', 'subSolver', { animated: true }),
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
    edge('e3', 'fanOut', 'mapper', { animated: true }),
    edge('e4', 'mapper', 'collector'),
    edge('e5', 'collector', 'reducer'),
    edge('e6', 'reducer', 'qualityCheck'),
    edge('e7', 'qualityCheck', 'output', {
      sourceHandle: 'true', label: 'Complete',
      animated: true, style: { stroke: '#16a34a' },
    }),
    edge('e8', 'qualityCheck', 'reducer', {
      sourceHandle: 'false', label: 'Gaps found',
      animated: true, style: { stroke: '#d97706' },
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
