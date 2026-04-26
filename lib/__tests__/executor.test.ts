import { describe, it, expect, vi } from 'vitest';
import { PipelineExecutor, type ExecutionEvent, type LLMCaller } from '../executor';
import type { Pipeline, FlowNode, FlowEdge } from '@/types/pipeline';

// ─── Test helpers ────────────────────────────────────────────────────────

function makePipeline(nodes: FlowNode[], edges: FlowEdge[]): Pipeline {
  return {
    id: 'test',
    name: 'Test',
    description: '',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    nodes,
    edges,
  };
}

function input(id = 'input', x = 0, y = 0): FlowNode {
  return { id, type: 'input', position: { x, y }, data: { label: 'Input' } };
}
function output(id = 'output', x = 0, y = 200): FlowNode {
  return { id, type: 'output', position: { x, y }, data: { label: 'Output' } };
}
function agent(
  id: string,
  role: string,
  systemPrompt: string,
  outputSchema?: { name: string; type: 'number' | 'string' | 'boolean' | 'enum' | 'array' | 'object' }[]
): FlowNode {
  return {
    id,
    type: 'llm_agent',
    position: { x: 0, y: 100 },
    data: {
      label: role,
      agentConfig: {
        role,
        model: 'claude-sonnet-4-6',
        systemPrompt,
        temperature: 0.5,
        maxTokens: 1024,
        outputSchema,
      },
    },
  };
}
function decision(id: string, condition: string, trueLabel = 'Yes', falseLabel = 'No'): FlowNode {
  return {
    id,
    type: 'decision',
    position: { x: 0, y: 200 },
    data: {
      label: 'Decision',
      decisionConfig: { condition, trueLabel, falseLabel },
    },
  };
}
function loop(id: string, max: number, breakCond: string): FlowNode {
  return {
    id,
    type: 'loop',
    position: { x: 0, y: 50 },
    data: {
      label: 'Loop',
      loopConfig: { maxIterations: max, breakCondition: breakCond },
    },
  };
}
function parallel(id: string, n: number): FlowNode {
  return {
    id,
    type: 'parallel',
    position: { x: 0, y: 50 },
    data: { label: 'Parallel', parallelConfig: { numParallel: n } },
  };
}
function aggregator(
  id: string,
  strategy: 'all' | 'best' | 'vote' | 'first' | 'concat',
  selectionCriteria?: string
): FlowNode {
  return {
    id,
    type: 'aggregator',
    position: { x: 0, y: 250 },
    data: { label: 'Agg', aggregatorConfig: { strategy, selectionCriteria } },
  };
}
function edge(source: string, target: string, sourceHandle?: string): FlowEdge {
  return {
    id: `${source}->${target}${sourceHandle ? `[${sourceHandle}]` : ''}`,
    source,
    target,
    ...(sourceHandle ? { sourceHandle } : {}),
  };
}

/** A scriptable LLM that returns predetermined responses based on the
 * user message it receives. Used to make pipeline tests deterministic. */
function mockLLM(
  responses: Record<string, string> | ((p: { system: string; user: string }) => string)
): LLMCaller {
  return {
    async call({ system, user }) {
      if (typeof responses === 'function') return responses({ system, user });
      // Try matching by system-prompt prefix first (since users vary)
      for (const key of Object.keys(responses)) {
        if (system.startsWith(key) || user.startsWith(key)) return responses[key];
      }
      throw new Error(`Mock LLM has no response for system="${system.slice(0, 40)}…" / user="${user.slice(0, 40)}…"`);
    },
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────

describe('PipelineExecutor — linear flow', () => {
  it('runs input → agent → output', async () => {
    const pipeline = makePipeline(
      [input(), agent('a', 'echo', 'Echo'), output()],
      [edge('input', 'a'), edge('a', 'output')]
    );
    const llm = mockLLM(() => 'hello');
    const events: ExecutionEvent[] = [];
    const exec = new PipelineExecutor(pipeline, { llm, onEvent: (e) => events.push(e) });
    const result = await exec.execute('greet');
    expect(result).toBe('hello');
    expect(events.find((e) => e.type === 'pipeline:complete')).toBeTruthy();
  });

  it('emits node:start and node:complete in order', async () => {
    const pipeline = makePipeline(
      [input(), agent('a', 'r', 'sys'), output()],
      [edge('input', 'a'), edge('a', 'output')]
    );
    const events: ExecutionEvent[] = [];
    const exec = new PipelineExecutor(pipeline, {
      llm: mockLLM(() => 'ok'),
      onEvent: (e) => events.push(e),
    });
    await exec.execute('x');
    const types = events.map((e) => `${e.type}:${'nodeId' in e ? e.nodeId : ''}`);
    expect(types).toContain('node:start:input');
    expect(types).toContain('node:complete:input');
    expect(types).toContain('node:start:a');
    expect(types).toContain('node:complete:a');
    expect(types).toContain('node:start:output');
    expect(types).toContain('node:complete:output');
  });
});

describe('PipelineExecutor — outputSchema parsing', () => {
  it('extracts JSON fields and exposes them as {role.field}', async () => {
    const pipeline = makePipeline(
      [
        input(),
        agent('grader', 'grader', 'Grade', [
          { name: 'score', type: 'number' },
          { name: 'verdict', type: 'enum' },
        ]),
        decision('check', '{{grader.score}} >= 0.8', 'pass', 'fail'),
        output('passNode'),
        output('failNode'),
      ],
      [
        edge('input', 'grader'),
        edge('grader', 'check'),
        edge('check', 'passNode', 'true'),
        edge('check', 'failNode', 'false'),
      ]
    );
    const llm = mockLLM(() => '```json\n{"score": 0.9, "verdict": "correct"}\n```');
    const events: ExecutionEvent[] = [];
    const exec = new PipelineExecutor(pipeline, { llm, onEvent: (e) => events.push(e) });
    await exec.execute('test');
    // Should have traversed via the 'true' handle to passNode.
    const traversed = events.filter((e) => e.type === 'edge:traverse').map((e) =>
      e.type === 'edge:traverse' ? `${e.from}->${e.to}` : ''
    );
    expect(traversed).toContain('check->passNode');
  });

  it('handles JSON without fences', async () => {
    const pipeline = makePipeline(
      [
        input(),
        agent('g', 'g', 's', [{ name: 'score', type: 'number' }]),
        decision('d', '{{g.score}} > 5'),
        output('o1'),
        output('o2'),
      ],
      [edge('input', 'g'), edge('g', 'd'), edge('d', 'o1', 'true'), edge('d', 'o2', 'false')]
    );
    const exec = new PipelineExecutor(pipeline, {
      llm: mockLLM(() => 'Here is my analysis: {"score": 7.5} done.'),
      onEvent: () => {},
    });
    await exec.execute('go');
    // No throw means the JSON was extracted and the decision evaluated successfully.
    expect(true).toBe(true);
  });

  it('errors clearly when a condition references a missing field', async () => {
    const pipeline = makePipeline(
      [
        input(),
        agent('g', 'g', 's'), // No outputSchema!
        decision('d', '{{g.score}} > 0.5'),
        output('o1'),
        output('o2'),
      ],
      [edge('input', 'g'), edge('g', 'd'), edge('d', 'o1', 'true'), edge('d', 'o2', 'false')]
    );
    const exec = new PipelineExecutor(pipeline, {
      llm: mockLLM(() => 'no JSON here'),
      onEvent: () => {},
    });
    await expect(exec.execute('go')).rejects.toThrow(/undefined variable/);
  });
});

describe('PipelineExecutor — decision branching', () => {
  it('takes the true branch when condition is satisfied', async () => {
    const pipeline = makePipeline(
      [
        input(),
        agent('g', 'g', 's', [{ name: 'score', type: 'number' }]),
        decision('d', '{{g.score}} >= 0.5'),
        agent('pass', 'pass_handler', 'pass'),
        agent('fail', 'fail_handler', 'fail'),
        output('o1'),
        output('o2'),
      ],
      [
        edge('input', 'g'),
        edge('g', 'd'),
        edge('d', 'pass', 'true'),
        edge('d', 'fail', 'false'),
        edge('pass', 'o1'),
        edge('fail', 'o2'),
      ]
    );
    const llm = mockLLM(({ system }) => {
      if (system === 's') return '{"score": 0.7}';
      if (system === 'pass') return 'PASSED';
      if (system === 'fail') return 'FAILED';
      return '';
    });
    const exec = new PipelineExecutor(pipeline, { llm, onEvent: () => {} });
    expect(await exec.execute('x')).toBe('PASSED');
  });

  it('takes the false branch when condition fails', async () => {
    const pipeline = makePipeline(
      [
        input(),
        agent('g', 'g', 's', [{ name: 'score', type: 'number' }]),
        decision('d', '{{g.score}} >= 0.5'),
        agent('pass', 'pass_handler', 'pass'),
        agent('fail', 'fail_handler', 'fail'),
        output('o1'),
        output('o2'),
      ],
      [
        edge('input', 'g'),
        edge('g', 'd'),
        edge('d', 'pass', 'true'),
        edge('d', 'fail', 'false'),
        edge('pass', 'o1'),
        edge('fail', 'o2'),
      ]
    );
    const llm = mockLLM(({ system }) => {
      if (system === 's') return '{"score": 0.2}';
      if (system === 'fail') return 'FAILED';
      return 'pass';
    });
    const exec = new PipelineExecutor(pipeline, { llm, onEvent: () => {} });
    expect(await exec.execute('x')).toBe('FAILED');
  });
});

describe('PipelineExecutor — parallel + aggregator', () => {
  it('best strategy picks the branch with the max selection field', async () => {
    const pipeline = makePipeline(
      [
        input(),
        parallel('fan', 3),
        agent('s', 'solver', 'solve', [{ name: 'score', type: 'number' }]),
        aggregator('agg', 'best', '{{solver.score}}'),
        output(),
      ],
      [edge('input', 'fan'), edge('fan', 's'), edge('s', 'agg'), edge('agg', 'output')]
    );
    let callCount = 0;
    const responses = ['{"score": 0.3}', '{"score": 0.9}', '{"score": 0.6}'];
    const llm: LLMCaller = {
      async call() {
        return responses[callCount++ % responses.length];
      },
    };
    const exec = new PipelineExecutor(pipeline, { llm, onEvent: () => {} });
    const result = await exec.execute('x');
    // Best score (0.9) wins → its raw output text is the result
    expect(result).toContain('"score": 0.9');
  });

  it('all strategy passes a list', async () => {
    const pipeline = makePipeline(
      [
        input(),
        parallel('fan', 2),
        agent('s', 'solver', 'solve'),
        aggregator('agg', 'all'),
        output(),
      ],
      [edge('input', 'fan'), edge('fan', 's'), edge('s', 'agg'), edge('agg', 'output')]
    );
    let i = 0;
    const llm: LLMCaller = { async call() { return `solution_${++i}`; } };
    const exec = new PipelineExecutor(pipeline, { llm, onEvent: () => {} });
    const result = await exec.execute('x');
    expect(Array.isArray(result)).toBe(true);
    expect((result as unknown[]).length).toBe(2);
  });

  it('concat strategy joins string outputs', async () => {
    const pipeline = makePipeline(
      [input(), parallel('fan', 3), agent('s', 'solver', 'solve'), aggregator('agg', 'concat'), output()],
      [edge('input', 'fan'), edge('fan', 's'), edge('s', 'agg'), edge('agg', 'output')]
    );
    let i = 0;
    const llm: LLMCaller = { async call() { return `chunk_${++i}`; } };
    const exec = new PipelineExecutor(pipeline, { llm, onEvent: () => {} });
    const result = await exec.execute('x');
    expect(typeof result).toBe('string');
    expect(result).toContain('chunk_1');
    expect(result).toContain('chunk_2');
    expect(result).toContain('chunk_3');
  });

  it('errors loudly when parallel has no downstream aggregator', async () => {
    const pipeline = makePipeline(
      [input(), parallel('fan', 2), agent('s', 'solver', 'solve'), output()],
      [edge('input', 'fan'), edge('fan', 's'), edge('s', 'output')]
    );
    const exec = new PipelineExecutor(pipeline, {
      llm: mockLLM(() => 'x'),
      onEvent: () => {},
    });
    await expect(exec.execute('x')).rejects.toThrow(/no downstream aggregator/);
  });
});

describe('PipelineExecutor — loop revisit cap', () => {
  it('aborts when a loop runs past maxIterations', async () => {
    // Build a pipeline that loops forever via a decision that always
    // evaluates true on the back-edge.
    const pipeline = makePipeline(
      [
        input(),
        loop('lp', 3, 'false'), // never breaks
        agent('worker', 'worker', 'work', [{ name: 'done', type: 'boolean' }]),
        decision('d', '{{worker.done}} == true'),
        output('o1'),
      ],
      [
        edge('input', 'lp'),
        edge('lp', 'worker'),
        edge('worker', 'd'),
        edge('d', 'o1', 'true'),
        edge('d', 'lp', 'false'), // cycle back
      ]
    );
    const llm: LLMCaller = { async call() { return '{"done": false}'; } };
    const exec = new PipelineExecutor(pipeline, { llm, onEvent: () => {} });
    await expect(exec.execute('x')).rejects.toThrow(/exceeded.*visits/);
  });

  it('completes when the loop body breaks early', async () => {
    const pipeline = makePipeline(
      [
        input(),
        loop('lp', 5, 'false'),
        agent('w', 'w', 's', [{ name: 'done', type: 'boolean' }]),
        decision('d', '{{w.done}} == true'),
        output('done'),
      ],
      [
        edge('input', 'lp'),
        edge('lp', 'w'),
        edge('w', 'd'),
        edge('d', 'done', 'true'),
        edge('d', 'lp', 'false'),
      ]
    );
    let i = 0;
    const llm: LLMCaller = {
      async call() {
        i++;
        return i >= 3 ? '{"done": true}' : '{"done": false}';
      },
    };
    const exec = new PipelineExecutor(pipeline, { llm, onEvent: () => {} });
    await exec.execute('x');
    expect(i).toBe(3);
  });
});

describe('PipelineExecutor — abort signal', () => {
  it('throws when aborted mid-execution', async () => {
    const pipeline = makePipeline(
      [input(), agent('a', 'a', 's'), output()],
      [edge('input', 'a'), edge('a', 'output')]
    );
    const ctrl = new AbortController();
    const llm: LLMCaller = {
      async call() {
        ctrl.abort();
        return 'x';
      },
    };
    const exec = new PipelineExecutor(pipeline, {
      llm,
      onEvent: () => {},
      signal: ctrl.signal,
    });
    await expect(exec.execute('x')).rejects.toThrow(/aborted/);
  });
});

describe('PipelineExecutor — unsupported nodes', () => {
  it('errors on human nodes', async () => {
    const pipeline = makePipeline(
      [
        input(),
        {
          id: 'h',
          type: 'human',
          position: { x: 0, y: 0 },
          data: { label: 'H', humanConfig: { prompt: 'review', approvalRequired: true } },
        },
        output(),
      ],
      [edge('input', 'h'), edge('h', 'output')]
    );
    const exec = new PipelineExecutor(pipeline, {
      llm: mockLLM(() => 'x'),
      onEvent: () => {},
    });
    await expect(exec.execute('x')).rejects.toThrow(/Human-in-the-loop/);
  });

  it('errors on tool nodes', async () => {
    const pipeline = makePipeline(
      [
        input(),
        {
          id: 't',
          type: 'tool',
          position: { x: 0, y: 0 },
          data: { label: 'T', toolConfig: { toolName: 'web', description: 'web' } },
        },
        output(),
      ],
      [edge('input', 't'), edge('t', 'output')]
    );
    const exec = new PipelineExecutor(pipeline, {
      llm: mockLLM(() => 'x'),
      onEvent: () => {},
    });
    await expect(exec.execute('x')).rejects.toThrow(/Tool nodes/);
  });
});
