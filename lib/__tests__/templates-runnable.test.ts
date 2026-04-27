import { describe, it, expect } from 'vitest';
import { PipelineExecutor, type LLMCaller } from '../executor';
import { TEMPLATES } from '../templates';

/**
 * End-to-end smoke tests on each shipped template. We use a deterministic
 * mock LLM that returns whatever JSON we need to exercise the template's
 * paths (e.g. always-passing grader to take the success branch). The point
 * isn't to test the model — it's to catch broken edge wiring, missing
 * outputSchema fields, unresolvable conditions, or missing aggregators in
 * the templates themselves.
 */

function counter() {
  let n = 0;
  return () => ++n;
}

describe('Momus IMO Solver template', () => {
  it('runs to completion on the success path', async () => {
    const tpl = TEMPLATES.find((t) => t.id === 'momus')!;
    const c = counter();
    const llm: LLMCaller = {
      async call({ system }) {
        // The dialectic-engine prompt opens with "## DIALECTIC ENGINE PROMPT".
        if (system.startsWith('## DIALECTIC ENGINE PROMPT')) return `solution_${c()}`;
        // Council of Graders prompt — emits 7/7 with the JSON tail.
        if (system.startsWith('## **Prompt: Council of Graders'))
          return 'Final Grade: 7/7\n\n```json\n{"grade": 7, "verdict": "Clean bill of health", "areas_for_improvement": [], "scaffolding_questions": []}\n```';
        // Conjecture extractor.
        if (system.startsWith('## Conjecture Extraction Prompt'))
          return '```json\n{"conjectures": ["C1"], "negations": ["¬C1"], "proof": "QED"}\n```';
        // Conjecture parser (re-extracts).
        if (system.startsWith('## Conjecture Parser'))
          return '```json\n{"conjectures": ["C1"], "negations": ["¬C1"], "proof": "QED"}\n```';
        // Quality checker.
        if (system.startsWith('You are a quality checker'))
          return 'PASS\n\n```json\n{"verdict": "PASS", "reason": "self-contained"}\n```';
        // Recursive verifier.
        if (system.startsWith('You are a recursive verifier'))
          return '```json\n{"proven_lemmas": [{"conjecture": "C1", "proof": "QED", "grade": 7}]}\n```';
        return 'ok';
      },
    };
    const exec = new PipelineExecutor(tpl.pipeline, { llm, onEvent: () => {} });
    const result = await exec.execute('Find n such that n^2 + n + 1 is prime.');
    // The pipeline should reach the final solver and return non-empty.
    expect(typeof result).toBe('string');
    expect(String(result).length).toBeGreaterThan(0);
  });
});

describe('Generate-Critique-Refine template', () => {
  it('exits the loop when critic says good enough', async () => {
    const tpl = TEMPLATES.find((t) => t.id === 'generate-critique-refine')!;
    let criticCallCount = 0;
    const llm: LLMCaller = {
      async call({ system }) {
        if (system.startsWith('You are a creative')) return 'draft v1';
        if (system.startsWith('You are a rigorous critic')) {
          criticCallCount++;
          // First call: low score (loop), second: high (exit)
          return criticCallCount === 1
            ? '{"score": 0.5, "strengths":[], "weaknesses":[], "suggestions":[]}'
            : '{"score": 0.9, "strengths":[], "weaknesses":[], "suggestions":[]}';
        }
        if (system.startsWith('You are an expert editor')) return 'refined v2';
        return 'ok';
      },
    };
    const exec = new PipelineExecutor(tpl.pipeline, { llm, onEvent: () => {} });
    await exec.execute('Write a haiku about latency.');
    // We should have exited via the second critic call.
    expect(criticCallCount).toBe(2);
  });
});

describe('Parallel-and-Distill template', () => {
  it('runs N parallel solvers and aggregates', async () => {
    const tpl = TEMPLATES.find((t) => t.id === 'parallel-and-distill')!;
    let solverCalls = 0;
    const llm: LLMCaller = {
      async call({ system }) {
        if (system.startsWith('You are an independent problem solver')) {
          solverCalls++;
          return `solution_${solverCalls}`;
        }
        if (system.startsWith('You are an expert evaluator')) return 'ranked summary';
        if (system.startsWith('You are a master synthesizer')) return 'final synthesis';
        return 'ok';
      },
    };
    const exec = new PipelineExecutor(tpl.pipeline, { llm, onEvent: () => {} });
    await exec.execute('Solve x^2 = 4.');
    expect(solverCalls).toBe(5); // numParallel: 5
  });
});

describe('Map-Reduce template', () => {
  it('reaches the reducer + completeness check', async () => {
    const tpl = TEMPLATES.find((t) => t.id === 'map-reduce')!;
    let mapperCalls = 0;
    const llm: LLMCaller = {
      async call({ system }) {
        if (system.includes('document chunking')) return '[{"chunk_id":1,"content":"a"}]';
        if (system.includes('focused data processor')) {
          mapperCalls++;
          return `mapped_${mapperCalls}`;
        }
        if (system.includes('synthesizer and data reducer'))
          return '{"output": "merged", "coverage": 0.97, "contradictions": false}';
        return 'ok';
      },
    };
    const exec = new PipelineExecutor(tpl.pipeline, { llm, onEvent: () => {} });
    await exec.execute('A long document...');
    expect(mapperCalls).toBe(8); // numParallel: 8
  });
});

describe('Huang-Yang Sequential Verify template', () => {
  it('exits on 5 consecutive successes (success threshold)', async () => {
    const tpl = TEMPLATES.find((t) => t.id === 'huang-yang')!;
    let verifyCount = 0;
    const llm: LLMCaller = {
      async call({ system }) {
        // Prover / Improver / Corrector: all use prover_system_prompt
        if (system.includes('rigorous IMO-level mathematician'))
          return 'Proof: We claim n=2 works. By exhaustive check...';
        // Completeness checker: "yes"
        if (system.includes('mathematical solution assessor'))
          return '{"verdict": "yes"}';
        // Verifier
        if (system.includes('meticulous IMO grader')) {
          verifyCount++;
          return 'Summary: The solution is correct. Detailed log: all steps verified.';
        }
        // Bug analyzer: always "yes" (correct) → consecutive_success increments each time
        if (system.includes('analyzing mathematical verification'))
          return '{"verdict": "yes"}';
        return 'ok';
      },
    };
    const exec = new PipelineExecutor(tpl.pipeline, { llm, onEvent: () => {} });
    const result = await exec.execute('Find all primes p such that p^2 + 2 is prime.');
    expect(typeof result).toBe('string');
    expect(String(result).length).toBeGreaterThan(0);
    // The verifier should have been called — the loop runs at least once before
    // the counter accumulates enough to trigger the break condition.
    expect(verifyCount).toBeGreaterThan(0);
  });

  it('counter resets on alternating verdicts', async () => {
    // Simulate: yes, no, yes, no, ... — neither threshold should be reached,
    // so the loop should hit maxIterations.
    const tpl = TEMPLATES.find((t) => t.id === 'huang-yang')!;
    let bugAnalyzerCalls = 0;
    const llm: LLMCaller = {
      async call({ system }) {
        if (system.includes('rigorous IMO-level mathematician'))
          return 'Proof attempt...';
        if (system.includes('mathematical solution assessor'))
          return '{"verdict": "yes"}';
        if (system.includes('meticulous IMO grader'))
          return 'Verification report...';
        if (system.includes('analyzing mathematical verification')) {
          bugAnalyzerCalls++;
          // Alternate: yes, no, yes, no — counter never reaches 5 or 10
          return bugAnalyzerCalls % 2 === 1
            ? '{"verdict": "yes"}'
            : '{"verdict": "no"}';
        }
        return 'ok';
      },
    };
    const exec = new PipelineExecutor(tpl.pipeline, { llm, onEvent: () => {} });
    await exec.execute('Prove Fermat Last Theorem.');
    // With alternating verdicts, consecutive counters never reach threshold.
    // The loop should exhaust maxIterations (40) and eventually terminate.
    // Bug analyzer should have been called multiple times.
    expect(bugAnalyzerCalls).toBeGreaterThan(2);
  });
});

describe('Parallel Divide & Resolve template', () => {
  it('decomposes, solves in parallel, resolves conflicts', async () => {
    const tpl = TEMPLATES.find((t) => t.id === 'parallel-divide-resolve')!;
    let workerCalls = 0;
    const llm: LLMCaller = {
      async call({ system }) {
        if (system.includes('strategic task planner'))
          return '{"subtasks": [{"title":"A"},{"title":"B"}], "integration_notes": "merge carefully"}';
        if (system.includes('focused subtask solver')) {
          workerCalls++;
          return `{"solution": "result_${workerCalls}", "assumptions": [], "conflict_risks": []}`;
        }
        if (system.includes('expert integrator'))
          return '{"merged_result": "unified", "has_conflicts": false, "conflicts": [], "resolution_suggestions": []}';
        if (system.includes('conflict mediator'))
          return 'resolved version';
        return 'ok';
      },
    };
    const exec = new PipelineExecutor(tpl.pipeline, { llm, onEvent: () => {} });
    await exec.execute('Design a microservices architecture.');
    expect(workerCalls).toBe(6); // numParallel: 6
  });
});

describe('Divide and Conquer template', () => {
  it('decomposes, solves in parallel, synthesizes', async () => {
    const tpl = TEMPLATES.find((t) => t.id === 'divide-and-conquer')!;
    let subCalls = 0;
    const llm: LLMCaller = {
      async call({ system }) {
        if (system.includes('strategic problem decomposer'))
          return 'sub-problems list';
        if (system.includes('focused problem solver')) {
          subCalls++;
          return `sub_${subCalls}`;
        }
        if (system.includes('master synthesizer')) return 'unified solution';
        return 'ok';
      },
    };
    const exec = new PipelineExecutor(tpl.pipeline, { llm, onEvent: () => {} });
    await exec.execute('Plan a project.');
    expect(subCalls).toBe(4); // numParallel: 4
  });
});
