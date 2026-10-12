import { NextResponse } from 'next/server';
import { resolveApproval } from '../../../../../lib/serverlessAgent';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const success = resolveApproval(id, body.approved ?? true);
  return NextResponse.json({ success });
}
