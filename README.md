# AgentForge

A visual designer + runtime for LLM agent pipelines. Drag-and-drop canvas
for designing multi-agent workflows like the
[Princeton-PLI Momus IMO solver](https://github.com/princeton-pli/momus-imo-solver)
or the [IMO25](https://github.com/dangxingyu/IMO25) experiments — and a
streaming runtime that actually executes them, lighting up each node as
it runs.

> Built for [Sanjeev Arora](https://www.cs.princeton.edu/~arora/)'s group
> at Princeton CS to design and run complex agent pipelines without
> editing YAML by hand.

## What it does

- **Design** — Drop nodes on a React Flow canvas: parallel fan-outs,
  decisions, loops, aggregators, LLM agents with editable system prompts
  and per-role output schemas.
- **Validate** — Conditions like `{{grader.grade}} >= 5` are parsed by a
  real expression engine and checked against upstream agents' declared
  output schemas. Unresolvable references are flagged on the canvas
  before you run.
- **Run** — Click Run, type an input, watch each node light up (running
  → done → error) with live streaming previews of LLM output. Built-in
  cost guardrails reject pipelines larger than 100 nodes / 200 edges /
  2M cumulative tokens.
- **Bring your own model** — Anthropic / OpenAI / OpenRouter (Gemini,
  DeepSeek, Llama, Qwen, Grok, ~150 more). Paste API keys in Settings;
  they live in browser localStorage and never persist server-side.

## Templates included

All match upstream paper / codebase structure faithfully:

| Template                          | What it is |
|-----------------------------------|------------|
| **Momus IMO Solver**              | Princeton-PLI Momus pipeline. Phase 1 solver-grader loop with feedback injection → Phase 2 conjecture extraction & verification → Phase 3 lemma-augmented final solving → Rule 2 triple-grader verification. Real verbatim prompts. |
| **Huang-Yang Sequential Verify**  | Iterative verify-with-bug-analyzer pattern (5 consecutive successes = solved, 10 failures = abort). |
| **Generate → Critique → Refine**  | Classic iterative quality loop. |
| **Parallel Solve → Distill**      | N parallel solvers, ranker, synthesizer. |
| **Divide & Conquer**              | Decompose, parallel sub-solve, synthesize. |
| **Map-Reduce**                    | Chunk → parallel map → reduce → completeness check. |
| **Parallel-Divide-Resolve**       | Parallel attempts with conflict resolution. |

## Tech

- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript**
- **Tailwind v4** — Airtable-inspired light theme
- **React Flow** — drag-and-drop canvas
- **Zustand** (with persist) — state + localStorage
- **CodeMirror 6** — markdown editor for system prompts
- **Anthropic SDK / OpenAI SDK / OpenRouter** — provider abstraction in
  [`lib/providers/`](lib/providers/)
- **Vitest** — covering the expression engine, executor, every shipped
  template end-to-end, and graph integrity

## Run it

```bash
git clone https://github.com/dangxingyu/agentforge.git
cd agentforge
npm install
npm run dev
```

Open <http://localhost:3000>. The Momus template loads by default.

You'll need at least one API key to run pipelines. Click **Settings** in
the toolbar and paste any of:

- Anthropic key — get one at <https://console.anthropic.com/settings/keys>
- OpenAI key — <https://platform.openai.com/api-keys>
- OpenRouter key — <https://openrouter.ai/keys>
  *(one key for Gemini, DeepSeek, Llama, Qwen, Grok, and Claude/GPT
  mirrors — same set of models the IMO25 codebase routes through)*

Keys live in browser localStorage and ride along in `/api/run`'s request
body. They never persist server-side.

### Optional: server-side default keys

For a single-user deploy you can put keys in `.env.local` instead and
skip the Settings panel:

```bash
cp .env.local.example .env.local
# then edit .env.local
```

Variables (any subset):

```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
OPENROUTER_API_KEY=sk-or-v1-...
```

Client-paste keys take priority when both are set.

## Development

```bash
npm run dev          # dev server on :3000
npm run build        # production build
npm run lint         # eslint
npm run test         # vitest run
npm run test:watch   # vitest in watch mode
```

### Project layout

```
agentforge/
├── app/
│   ├── page.tsx              # 3-panel layout: Chat | Canvas | NodeDetail
│   ├── api/chat/route.ts     # Streaming pipeline-designer chat (Anthropic)
│   ├── api/run/route.ts      # Streaming pipeline runner (multi-provider)
│   └── api/pipeline/route.ts # Persistence (in-memory, swap for DB)
├── components/
│   ├── Canvas.tsx            # React Flow wrapper
│   ├── ChatPanel.tsx         # Left sidebar, AI designer
│   ├── NodeDetail.tsx        # Right sidebar, per-node editor
│   ├── RunPanel.tsx          # Run UI, replaces ChatPanel during execution
│   ├── SettingsModal.tsx     # API keys + custom OpenRouter models
│   ├── Toolbar.tsx
│   ├── PromptEditor.tsx      # CodeMirror markdown editor
│   ├── ConditionEditor.tsx   # {{role.field}} picker + syntax check
│   ├── OutputSchemaEditor.tsx
│   └── nodes/                # 8 React Flow custom node types
├── lib/
│   ├── executor.ts           # Graph interpreter (parallel + decision + loop)
│   ├── expression.ts         # Recursive-descent parser for conditions
│   ├── providers/            # Anthropic / OpenAI / OpenRouter adapters
│   ├── models.ts             # Curated model registry
│   ├── pipeline.ts           # YAML/JSON export, upstream-schema collection
│   └── templates.ts          # 7 pipeline templates
├── store/
│   ├── pipelineStore.ts      # Pipeline state (persisted)
│   ├── runStore.ts           # Run state (ephemeral)
│   └── settingsStore.ts      # API keys + custom models (persisted)
└── types/pipeline.ts         # Shared types
```

### Adding a model

1. Add an entry to `MODELS` in [`lib/models.ts`](lib/models.ts) — set
   `provider`, `providerModel` (the API's model name), and capabilities.
2. The model immediately appears in the NodeDetail dropdown grouped
   under its provider. No code changes needed in the executor.

For one-off OpenRouter slugs, users can paste them into Settings → Custom
OpenRouter models without touching code.

### Adding a node kind

1. Add the kind to `NodeKind` in [`types/pipeline.ts`](types/pipeline.ts)
   with its config interface.
2. Drop a custom node component in [`components/nodes/`](components/nodes/)
   and register it in [`Canvas.tsx`](components/Canvas.tsx)'s
   `nodeTypes` map.
3. Handle the new kind in `PipelineExecutor.run`
   ([`lib/executor.ts`](lib/executor.ts)).

## Architecture notes

- **Expression engine** is hand-rolled (no `eval`, no `Function`). See
  [`lib/expression.ts`](lib/expression.ts). Grammar in the file header.
- **Provider abstraction** is the only seam between runtime and SDK
  ([`lib/providers/types.ts`](lib/providers/types.ts) → `LLMProvider`).
  Adding a new provider is one file.
- **Run guardrails** are enforced in
  [`app/api/run/route.ts`](app/api/run/route.ts): max 100 nodes, max 200
  edges, max 200k tokens per node, max 2M cumulative tokens, max 32-way
  parallel, max 100-iter loops. Hardcoded for now — wire to env vars or
  per-account quotas if you deploy multi-tenant.
- **Abort signal** is threaded all the way through: client *Stop* →
  server `req.signal` → executor `AbortController` → Anthropic/OpenAI
  SDK request signal. Cancelled runs don't bill for in-flight
  completions you'll never see.

## Deploy

Vercel:

```bash
vercel
```

Set the env vars (`ANTHROPIC_API_KEY` / `OPENAI_API_KEY` /
`OPENROUTER_API_KEY`) in the project settings if you want server-side
default keys; otherwise leave them blank and tell users to paste their
own in Settings.

Heads-up: the in-memory `/api/pipeline` store doesn't persist across
serverless invocations. Use the client's localStorage (default save
path) or wire to a real DB before relying on it for sharing.

## License

MIT.
