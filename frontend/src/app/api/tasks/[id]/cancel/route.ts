import { NextResponse } from 'next/server';
import { cancelTaskRecord } from '../../../../../lib/serverlessAgent';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await cancelTaskRecord(id);
  return NextResponse.json({ success: true, taskId: id, status: 'cancelled' });
}
