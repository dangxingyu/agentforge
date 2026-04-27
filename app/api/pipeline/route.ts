import { NextRequest, NextResponse } from 'next/server';
import type { Pipeline } from '@/types/pipeline';

/**
 * Pipeline persistence — currently in-memory (per-server-instance).
 *
 * Caveat: this Map is reset on every server restart and is NOT shared
 * across replicas. The primary save path for AgentForge is the client's
 * localStorage (via `store/pipelineStore.ts` zustand persist middleware);
 * this endpoint is here for explicit "save to server" / "share via URL"
 * flows that aren't wired up yet.
 *
 * Promote to a real DB (Postgres, Redis, etc.) before relying on it for
 * anything beyond a single-user local deploy.
 */
const pipelines = new Map<string, Pipeline>();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (id) {
    const pipeline = pipelines.get(id);
    if (!pipeline) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(pipeline);
  }

  return NextResponse.json(Array.from(pipelines.values()));
}

export async function POST(req: NextRequest) {
  let pipeline: Pipeline;
  try {
    pipeline = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!pipeline || typeof pipeline !== 'object') {
    return NextResponse.json({ error: 'Body must be a Pipeline object' }, { status: 400 });
  }
  if (typeof pipeline.id !== 'string' || !pipeline.id) {
    return NextResponse.json({ error: 'Pipeline missing required `id`' }, { status: 400 });
  }
  if (!Array.isArray(pipeline.nodes) || !Array.isArray(pipeline.edges)) {
    return NextResponse.json(
      { error: 'Pipeline must have `nodes` and `edges` arrays' },
      { status: 400 }
    );
  }

  pipeline.updatedAt = new Date().toISOString();
  pipelines.set(pipeline.id, pipeline);

  return NextResponse.json({ success: true, id: pipeline.id });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  pipelines.delete(id);

  return NextResponse.json({ success: true });
}
