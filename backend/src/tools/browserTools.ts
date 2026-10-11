import { z } from 'zod';
import type { ToolDefinition } from '../types/index.js';
import { BrowserController } from '../browser/browserController.js';

let sharedBrowser: BrowserController | null = null;

export function getBrowserController(portalUrl?: string): BrowserController {
  if (!sharedBrowser) {
    sharedBrowser = new BrowserController(portalUrl || process.env.SIMULATED_PORTAL_URL || 'http://localhost:4001');
  }
  return sharedBrowser;
}

export const openAllowedPageTool: ToolDefinition = {
  name: 'open_allowed_page',
  description: 'Navigate the automation browser to a permitted portal page (strictly restricted to localhost portal).',
  sideEffect: 'read_only',
  timeoutMs: 20000,
  inputSchema: z.object({
    pathOrUrl: z.string().describe('Relative path or allowed portal URL (e.g. "/" or "/index.html")')
  }),
  execute: async ({ pathOrUrl }, context) => {
    const browser = getBrowserController(context.portalUrl);
    return await browser.openAllowedPage(pathOrUrl);
  }
};

export const inspectPageTool: ToolDefinition = {
  name: 'inspect_page',
  description: 'Inspect the visible text or inspect a specific element selector on the current browser page.',
  sideEffect: 'read_only',
  timeoutMs: 15000,
  inputSchema: z.object({
    selector: z.string().optional().describe('Optional CSS selector or testid to target (e.g. "#invoices-table" or "[data-testid=search-input]")')
  }),
  execute: async ({ selector }, context) => {
    const browser = getBrowserController(context.portalUrl);
    return await browser.inspectPage(selector);
  }
};

export const clickElementTool: ToolDefinition = {
  name: 'click_element',
  description: 'Click a button, link, or interactive element on the page using a selector.',
  sideEffect: 'read_only',
  timeoutMs: 15000,
  inputSchema: z.object({
    selector: z.string().min(1, 'Selector is required').describe('CSS selector or data-testid to click (e.g. "#submit-record-btn" or "[data-testid=search-btn]")')
  }),
  execute: async ({ selector }, context) => {
    const browser = getBrowserController(context.portalUrl);
    return await browser.clickElement(selector);
  }
};

export const fillFieldTool: ToolDefinition = {
  name: 'fill_field',
  description: 'Type text into an input field or form control on the browser page.',
  sideEffect: 'read_only',
  timeoutMs: 15000,
  inputSchema: z.object({
    selector: z.string().min(1, 'Selector is required').describe('CSS selector for input field (e.g. "#record-company-name")'),
    value: z.string().describe('Value to fill into the input field')
  }),
  execute: async ({ selector, value }, context) => {
    const browser = getBrowserController(context.portalUrl);
    return await browser.fillField(selector, value);
  }
};

export const extractTableTool: ToolDefinition = {
  name: 'extract_table',
  description: 'Extract structured rows and column headers from an HTML table on the page.',
  sideEffect: 'read_only',
  timeoutMs: 15000,
  inputSchema: z.object({
    tableSelector: z.string().min(1, 'tableSelector is required').describe('CSS selector for table element (e.g. "#invoices-table")')
  }),
  execute: async ({ tableSelector }, context) => {
    const browser = getBrowserController(context.portalUrl);
    return await browser.extractTable(tableSelector);
  }
};

export const captureScreenshotTool: ToolDefinition = {
  name: 'capture_screenshot',
  description: 'Capture a full-page screenshot of the browser as execution evidence.',
  sideEffect: 'read_only',
  timeoutMs: 15000,
  inputSchema: z.object({
    name: z.string().optional().describe('Descriptive name prefix for the screenshot')
  }),
  execute: async ({ name }, context) => {
    const browser = getBrowserController(context.portalUrl);
    return await browser.captureScreenshot(name || `task_${context.taskId}`);
  }
};
