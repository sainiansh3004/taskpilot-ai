import { NextResponse } from 'next/server';
import { portalInvoices } from '../../../../lib/serverlessAgent';

export async function GET() {
  return NextResponse.json({
    count: portalInvoices.length,
    invoices: portalInvoices
  });
}
