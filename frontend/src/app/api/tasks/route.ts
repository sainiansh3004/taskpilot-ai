import { NextResponse } from 'next/server';
import { getAllTasks, createAndRunTask } from '../../../lib/serverlessAgent';

export async function GET() {
  const tasks = getAllTasks();
  return NextResponse.json({ tasks });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.goal || !body.goal.trim()) {
      return NextResponse.json({ error: 'Goal is required' }, { status: 400 });
    }
    const task = await createAndRunTask(body.goal);
    return NextResponse.json({ task });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create task' }, { status: 500 });
  }
}
