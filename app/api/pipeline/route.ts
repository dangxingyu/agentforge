import { NextRequest, NextResponse } from 'next/server';
import type { Pipeline } from '@/types/pipeline';

// In-memory store (replace with database in production)
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
  const pipeline: Pipeline = await req.json();

  if (!pipeline.id || !pipeline.nodes) {
    return NextResponse.json({ error: 'Invalid pipeline' }, { status: 400 });
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
