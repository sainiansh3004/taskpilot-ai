import { ToolRegistry } from './registry.js';
import {
  searchInvoicesTool,
  readInvoiceTool,
  listInvoiceRecordsTool,
  createInvoiceRecordTool,
  verifyInvoiceRecordTool
} from './invoiceTools.js';
import {
  listSampleDocumentsTool,
  readDocumentTool,
  extractInvoiceFieldsTool
} from './documentTools.js';
import {
  requestApprovalTool,
  requestClarificationTool,
  inspectTaskStateTool
} from './workflowTools.js';
import {
  openAllowedPageTool,
  inspectPageTool,
  clickElementTool,
  fillFieldTool,
  extractTableTool,
  captureScreenshotTool
} from './browserTools.js';

export function createDefaultToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  // Invoice API tools
  registry.register(searchInvoicesTool);
  registry.register(readInvoiceTool);
  registry.register(listInvoiceRecordsTool);
  registry.register(createInvoiceRecordTool);
  registry.register(verifyInvoiceRecordTool);

  // Document tools
  registry.register(listSampleDocumentsTool);
  registry.register(readDocumentTool);
  registry.register(extractInvoiceFieldsTool);

  // Workflow tools
  registry.register(requestApprovalTool);
  registry.register(requestClarificationTool);
  registry.register(inspectTaskStateTool);

  // Browser tools
  registry.register(openAllowedPageTool);
  registry.register(inspectPageTool);
  registry.register(clickElementTool);
  registry.register(fillFieldTool);
  registry.register(extractTableTool);
  registry.register(captureScreenshotTool);

  return registry;
}

export { ToolRegistry };
