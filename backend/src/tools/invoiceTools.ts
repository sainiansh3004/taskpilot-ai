import { z } from 'zod';
import type { ToolDefinition } from '../types/index.js';

export const searchInvoicesTool: ToolDefinition = {
  name: 'search_invoices',
  description: 'Search invoices in the company portal by vendor/company name, invoice number, or keyword.',
  sideEffect: 'read_only',
  timeoutMs: 10000,
  inputSchema: z.object({
    query: z.string().describe('Search keyword or company name (e.g. "Acme Ltd", "Globex", "INV-2024")').default('')
  }),
  execute: async ({ query }, context) => {
    const url = `${context.portalUrl}/api/invoices?search=${encodeURIComponent(query || '')}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to search invoices: HTTP ${res.status} ${res.statusText}`);
    }
    const data = await res.json() as any;
    return {
      count: data.count,
      invoices: data.invoices
    };
  }
};

export const readInvoiceTool: ToolDefinition = {
  name: 'read_invoice',
  description: 'Retrieve full details, line items, and terms for a specific invoice by its ID.',
  sideEffect: 'read_only',
  timeoutMs: 10000,
  inputSchema: z.object({
    invoiceId: z.string().min(1, 'Invoice ID is required').describe('The unique ID of the invoice (e.g. "inv-acme-002")')
  }),
  execute: async ({ invoiceId }, context) => {
    const url = `${context.portalUrl}/api/invoices/${encodeURIComponent(invoiceId)}`;
    const res = await fetch(url);
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({})) as any;
      throw new Error(errBody.error || `Invoice '${invoiceId}' not found (HTTP ${res.status})`);
    }
    const data = await res.json() as any;
    return data.invoice;
  }
};

export const listInvoiceRecordsTool: ToolDefinition = {
  name: 'list_invoice_records',
  description: 'List all processed invoice records currently saved in the internal accounting ledger.',
  sideEffect: 'read_only',
  timeoutMs: 10000,
  inputSchema: z.object({}),
  execute: async (_input, context) => {
    const url = `${context.portalUrl}/api/records`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to list invoice records: HTTP ${res.status}`);
    }
    const data = await res.json() as any;
    return {
      count: data.count,
      records: data.records
    };
  }
};

export const createInvoiceRecordTool: ToolDefinition = {
  name: 'create_invoice_record',
  description: 'Enter an invoice into the internal accounting records system. Note: This creates an actual financial ledger entry.',
  sideEffect: 'consequential_write',
  timeoutMs: 10000,
  inputSchema: z.object({
    invoiceId: z.string().min(1, 'Invoice ID is required').describe('Source invoice ID (e.g. "inv-acme-002")'),
    companyName: z.string().min(1, 'Company Name is required').describe('Vendor/Company name (e.g. "Acme Ltd")'),
    invoiceNumber: z.string().min(1, 'Invoice Number is required').describe('Invoice number (e.g. "INV-2024-098")'),
    amount: z.number().positive('Amount must be positive').describe('Total invoice amount (e.g. 3890.50)'),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be YYYY-MM-DD').describe('Due date in YYYY-MM-DD format'),
    currency: z.string().default('USD').describe('Currency code (e.g. "USD")'),
    notes: z.string().optional().describe('Optional audit notes or rationale')
  }),
  execute: async (input, context) => {
    const url = `${context.portalUrl}/api/records`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });

    const data = await res.json() as any;
    if (!res.ok) {
      throw new Error(data.message || data.error || `Failed to create record: HTTP ${res.status}`);
    }

    return {
      success: true,
      message: data.message,
      record: data.record
    };
  }
};

export const verifyInvoiceRecordTool: ToolDefinition = {
  name: 'verify_invoice_record',
  description: 'Verify that an invoice has been correctly entered into the ledger by comparing the saved record against the source invoice.',
  sideEffect: 'read_only',
  timeoutMs: 10000,
  inputSchema: z.object({
    invoiceNumber: z.string().min(1, 'Invoice number is required').describe('The invoice number to verify (e.g. "INV-2024-098")'),
    expectedAmount: z.number().optional().describe('Expected amount to check against'),
    expectedDueDate: z.string().optional().describe('Expected due date (YYYY-MM-DD)')
  }),
  execute: async ({ invoiceNumber, expectedAmount, expectedDueDate }, context) => {
    const url = `${context.portalUrl}/api/records/${encodeURIComponent(invoiceNumber)}`;
    const res = await fetch(url);
    if (!res.ok) {
      return {
        verified: false,
        exists: false,
        error: `Record for invoice '${invoiceNumber}' not found in internal ledger.`
      };
    }

    const data = await res.json() as any;
    const record = data.record;

    const checks: Record<string, { expected: any; actual: any; match: boolean }> = {};

    if (expectedAmount !== undefined) {
      checks.amount = {
        expected: expectedAmount,
        actual: record.amount,
        match: Math.abs(record.amount - expectedAmount) < 0.01
      };
    }

    if (expectedDueDate !== undefined) {
      checks.dueDate = {
        expected: expectedDueDate,
        actual: record.dueDate,
        match: record.dueDate === expectedDueDate
      };
    }

    const allMatched = Object.values(checks).every(c => c.match);

    return {
      verified: allMatched,
      exists: true,
      record,
      fieldChecks: checks
    };
  }
};
