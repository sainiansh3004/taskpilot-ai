import { NextResponse } from 'next/server';
import { getTask } from '../../../../lib/serverlessAgent';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = getTask(id);
  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }
  return NextResponse.json({ task });
}
