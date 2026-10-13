import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const accept = req.headers.get('accept') || '';
  // If visited via browser navigation, redirect to the standalone Portal UI page
  if (accept.includes('text/html')) {
    return NextResponse.redirect(new URL('/portal', req.url));
  }

  // Otherwise return structured JSON metadata for programmatic consumers
  return NextResponse.json({
    status: 'ok',
    service: 'TaskPilot AI Simulated Enterprise ERP Portal API',
    endpoints: {
      invoices: '/api/portal/invoices',
      records: '/api/portal/records',
      ui: '/portal'
    },
    documentation: 'https://github.com/sainiansh3004/taskpilot-ai'
  });
}
