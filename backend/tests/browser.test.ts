import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Server } from 'node:http';
import { createPortalApp } from '../../simulated-company/src/server.js';
import { PortalDatabase } from '../../simulated-company/src/database.js';
import { BrowserController } from '../src/browser/browserController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_PORTAL_DB = path.resolve(__dirname, '../../data/test_browser_portal.sqlite');
const TEST_PORTAL_PORT = 4098;
const TEST_PORTAL_URL = `http://localhost:${TEST_PORTAL_PORT}`;

describe('Playwright Browser Automation (Restricted Local Environment)', { timeout: 15000 }, () => {
  let portalServer: Server;
  let portalDb: PortalDatabase;
  let browser: BrowserController;

  beforeAll(async () => {
    if (fs.existsSync(TEST_PORTAL_DB)) fs.unlinkSync(TEST_PORTAL_DB);
    portalDb = new PortalDatabase(TEST_PORTAL_DB);
    const { app } = createPortalApp(portalDb);

    await new Promise<void>((resolve) => {
      portalServer = app.listen(TEST_PORTAL_PORT, () => resolve());
    });

    browser = new BrowserController(TEST_PORTAL_URL);
  });

  afterAll(async () => {
    await browser.close();
    portalDb.db.close();
    await new Promise<void>((resolve) => portalServer.close(() => resolve()));
    if (fs.existsSync(TEST_PORTAL_DB)) fs.unlinkSync(TEST_PORTAL_DB);
  });

  it('rejects navigation to external or unauthorized domains for security', async () => {
    await expect(browser.openAllowedPage('https://google.com')).rejects.toThrowError(/SECURITY_VIOLATION/);
    await expect(browser.openAllowedPage('http://malicious-site.org/phishing')).rejects.toThrowError(/SECURITY_VIOLATION/);
  });

  it('navigates to permitted local portal and inspects page title and content', async () => {
    const pageInfo = await browser.openAllowedPage('/');
    expect(pageInfo.url).toContain(TEST_PORTAL_URL);
    expect(pageInfo.title).toContain('Enterprise Invoice Portal');

    const page = await browser.getPage();
    await page.waitForSelector('#invoices-table-body tr', { timeout: 10000 });

    const inspection = await browser.inspectPage('#invoices-table');
    expect(inspection.elementCount).toBe(1);
    expect(inspection.visibleText).toContain('Acme Ltd');
  });

  it('extracts table data into structured JSON', async () => {
    const tableData = await browser.extractTable('#invoices-table');
    expect(tableData.headers.length).toBeGreaterThan(0);
    expect(tableData.rows.length).toBeGreaterThan(0);

    const acmeRow = tableData.rows.find(row => row.some(cell => cell.includes('Acme Ltd')));
    expect(acmeRow).toBeDefined();
  });

  it('fills input fields in the create record form', async () => {
    const fillResult = await browser.fillField('#record-invoice-id', 'inv-acme-002');
    expect(fillResult.filled).toBe(true);
    expect(fillResult.value).toBe('inv-acme-002');
  });

  it('captures full page screenshot as execution evidence', async () => {
    const screenshot = await browser.captureScreenshot('browser_test_evidence');
    expect(screenshot.filename).toBeDefined();
    expect(screenshot.relativePath).toMatch(/^\/screenshots\/browser_test_evidence_/);

    const fullPath = path.resolve(__dirname, '../../screenshots', screenshot.filename);
    expect(fs.existsSync(fullPath)).toBe(true);
    expect(fs.statSync(fullPath).size).toBeGreaterThan(1000);
  });
});
