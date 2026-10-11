import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ToolDefinition } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SAMPLE_DOCS_DIR = path.resolve(__dirname, '../../../simulated-company/sample_documents');

export const listSampleDocumentsTool: ToolDefinition = {
  name: 'list_sample_documents',
  description: 'List available local vendor invoice document files in the company document repository.',
  sideEffect: 'read_only',
  timeoutMs: 5000,
  inputSchema: z.object({}),
  execute: async () => {
    if (!fs.existsSync(SAMPLE_DOCS_DIR)) {
      return { documents: [] };
    }
    const files = fs.readdirSync(SAMPLE_DOCS_DIR).filter(f => f.endsWith('.txt') || f.endsWith('.md') || f.endsWith('.json'));
    return {
      count: files.length,
      documents: files
    };
  }
};

export const readDocumentTool: ToolDefinition = {
  name: 'read_document',
  description: 'Read the raw text content of a sample invoice document from the local document repository.',
  sideEffect: 'read_only',
  timeoutMs: 5000,
  inputSchema: z.object({
    filename: z.string().min(1, 'Filename is required').describe('The filename to read (e.g. "invoice_acme_2024_098.txt")')
  }),
  execute: async ({ filename }) => {
    // Sanitize to prevent path traversal
    const safeFilename = path.basename(filename);
    const fullPath = path.join(SAMPLE_DOCS_DIR, safeFilename);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`FILE_NOT_FOUND: Document '${safeFilename}' does not exist in sample documents repository.`);
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    return {
      filename: safeFilename,
      content,
      sizeBytes: content.length
    };
  }
};

export const extractInvoiceFieldsTool: ToolDefinition = {
  name: 'extract_supported_invoice_fields',
  description: 'Extract structured metadata (Company, Invoice Number, Amount, Due Date, Currency) from invoice document content or text.',
  sideEffect: 'read_only',
  timeoutMs: 5000,
  inputSchema: z.object({
    content: z.string().min(1, 'Content is required').describe('The invoice document text to parse')
  }),
  execute: async ({ content }) => {
    // Regex extractors with robust pattern matching
    const companyMatch = content.match(/Company\s*Name:\s*([^\r\n]+)/i);
    const invoiceNumMatch = content.match(/Invoice\s*Number:\s*([^\r\n]+)/i);
    const issueDateMatch = content.match(/Issue\s*Date:\s*(\d{4}-\d{2}-\d{2})/i);
    const dueDateMatch = content.match(/Due\s*Date:\s*(\d{4}-\d{2}-\d{2})/i);
    const amountMatch = content.match(/(?:Total\s*Amount\s*Due|Total):\s*\$?\s*([\d,]+\.?\d*)/i);
    const currencyMatch = content.match(/\b(USD|EUR|GBP|CAD)\b/i);

    const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : undefined;

    const extracted = {
      companyName: companyMatch ? companyMatch[1].trim() : undefined,
      invoiceNumber: invoiceNumMatch ? invoiceNumMatch[1].trim() : undefined,
      issueDate: issueDateMatch ? issueDateMatch[1].trim() : undefined,
      dueDate: dueDateMatch ? dueDateMatch[1].trim() : undefined,
      amount,
      currency: currencyMatch ? currencyMatch[1].toUpperCase() : 'USD',
      missingFields: [] as string[]
    };

    if (!extracted.companyName) extracted.missingFields.push('companyName');
    if (!extracted.invoiceNumber) extracted.missingFields.push('invoiceNumber');
    if (!extracted.amount) extracted.missingFields.push('amount');
    if (!extracted.dueDate) extracted.missingFields.push('dueDate');

    return {
      extracted,
      isValid: extracted.missingFields.length === 0,
      missingFields: extracted.missingFields
    };
  }
};
