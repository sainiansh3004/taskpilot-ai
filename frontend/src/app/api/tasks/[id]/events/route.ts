import { NextResponse } from 'next/server';
import { readTaskEvents } from '../../../../../lib/serverlessAgent';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const events = await readTaskEvents(id);
  return NextResponse.json({ events });
}
