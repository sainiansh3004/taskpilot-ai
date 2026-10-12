import { NextResponse } from 'next/server';
import { portalRecords } from '../../../../lib/serverlessAgent';

export async function GET() {
  return NextResponse.json({
    count: portalRecords.length,
    records: portalRecords
  });
}
