import { NextResponse } from 'next/server';
import { getTaskEvents } from '../../../../../lib/serverlessAgent';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const events = getTaskEvents(id);
  return NextResponse.json({ events });
}
