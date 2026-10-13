import { NextResponse } from 'next/server';
import { readPortalRecords } from '../../../../../lib/serverlessAgent';

export async function GET() {
  const records = await readPortalRecords();
  return NextResponse.json({
    count: records.length,
    records
  });
}
