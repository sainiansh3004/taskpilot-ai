import { after, NextResponse } from 'next/server';
import { createAndRunTask, readTasks, waitForTaskExecution } from '../../../lib/serverlessAgent';

export const maxDuration = 300;

export async function GET(req: Request) {
  const tasks = await readTasks();
  const status = new URL(req.url).searchParams.get('status');
  const filteredTasks = status ? tasks.filter(task => task.status === status) : tasks;
  return NextResponse.json({ tasks: filteredTasks });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.goal || !body.goal.trim()) {
      return NextResponse.json({ error: 'Goal is required' }, { status: 400 });
    }
    const task = await createAndRunTask(body.goal);
    after(async () => {
      try {
        await waitForTaskExecution(task.id);
      } catch (error) {
        console.error(`Background execution for task ${task.id} failed:`, error);
      }
    });
    return NextResponse.json({ task });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create task';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
