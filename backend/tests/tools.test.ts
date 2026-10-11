import { describe, it, expect } from 'vitest';
import { createDefaultToolRegistry } from '../src/tools/index.js';
import type { AgentContext } from '../src/types/index.js';

describe('Tool Registry & Input Validation', () => {
  const registry = createDefaultToolRegistry();

  const mockContext: AgentContext = {
    taskId: 'test_task',
    stepNumber: 1,
    memory: {},
    portalUrl: 'http://localhost:4001',
    requireApprovalForWrites: false,
    emitEvent: () => {},
    requestApproval: async () => true,
    requestClarification: async () => 'Clarified'
  };

  it('contains all required invoice, browser, document, and workflow tools', () => {
    const allTools = registry.getAll();
    const toolNames = allTools.map(t => t.name);

    expect(toolNames).toContain('search_invoices');
    expect(toolNames).toContain('read_invoice');
    expect(toolNames).toContain('create_invoice_record');
    expect(toolNames).toContain('verify_invoice_record');
    expect(toolNames).toContain('list_sample_documents');
    expect(toolNames).toContain('read_document');
    expect(toolNames).toContain('extract_supported_invoice_fields');
    expect(toolNames).toContain('request_approval');
    expect(toolNames).toContain('request_clarification');
    expect(toolNames).toContain('open_allowed_page');
  });

  it('rejects invalid arguments for create_invoice_record using Zod schema', async () => {
    // Missing required fields and negative amount
    const invalidArgs = {
      invoiceId: 'inv-123',
      companyName: '',
      amount: -50.0,
      dueDate: 'invalid-date'
    };

    const result = await registry.executeTool('create_invoice_record', invalidArgs, mockContext);
    expect(result.success).toBe(false);
    expect(result.error).toContain('ARGUMENT_VALIDATION_ERROR');
  });

  it('correctly classifies create_invoice_record as consequential_write', () => {
    const tool = registry.get('create_invoice_record');
    expect(tool).toBeDefined();
    expect(tool?.sideEffect).toBe('consequential_write');
  });

  it('correctly classifies read_only tools', () => {
    const searchTool = registry.get('search_invoices');
    expect(searchTool?.sideEffect).toBe('read_only');

    const readDocTool = registry.get('read_document');
    expect(readDocTool?.sideEffect).toBe('read_only');
  });

  it('parses structured fields from sample document text', async () => {
    const sampleText = `
Company Name: Acme Ltd
Invoice Number: INV-2024-098
Issue Date: 2024-05-10
Due Date: 2024-06-10
Total: $3,890.50 USD
`;

    const result = await registry.executeTool(
      'extract_supported_invoice_fields',
      { content: sampleText },
      mockContext
    );

    expect(result.success).toBe(true);
    expect(result.data.extracted.companyName).toBe('Acme Ltd');
    expect(result.data.extracted.invoiceNumber).toBe('INV-2024-098');
    expect(result.data.extracted.amount).toBe(3890.50);
    expect(result.data.extracted.dueDate).toBe('2024-06-10');
    expect(result.data.isValid).toBe(true);
  });

  it('identifies missing fields in incomplete document', async () => {
    const incompleteText = `
Company Name: Wayne Enterprises
Invoice Number: INV-2024-401
Total: $9,999.00 USD
`;

    const result = await registry.executeTool(
      'extract_supported_invoice_fields',
      { content: incompleteText },
      mockContext
    );

    expect(result.success).toBe(true);
    expect(result.data.isValid).toBe(false);
    expect(result.data.missingFields).toContain('dueDate');
  });
});
