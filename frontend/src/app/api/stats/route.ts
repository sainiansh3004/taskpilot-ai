import { NextResponse } from 'next/server';
import { hasSharedState } from '../../../lib/sharedState';
import { readTasks } from '../../../lib/serverlessAgent';

export async function GET() {
  const tasks = await readTasks();
  const stats = {
    totalTasks: tasks.length,
    verified: tasks.filter(task => task.status === 'succeeded').length,
    failed: tasks.filter(task => ['failed', 'budget_exhausted'].includes(task.status)).length,
    pendingApproval: tasks.filter(task => task.status === 'awaiting_approval').length,
    pendingClarification: tasks.filter(task => task.status === 'awaiting_clarification').length,
    statePersistence: hasSharedState ? 'shared' as const : 'instance-local' as const
  };
  return NextResponse.json({ stats });
}
