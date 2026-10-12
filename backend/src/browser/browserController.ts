import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOTS_DIR = process.env.SCREENSHOTS_DIR || path.resolve(__dirname, '../../../screenshots');

export class BrowserController {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private allowedBaseUrl: string;

  constructor(allowedBaseUrl = 'http://localhost:4001') {
    this.allowedBaseUrl = allowedBaseUrl;
    if (!fs.existsSync(SCREENSHOTS_DIR)) {
      fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    }
  }

  private isAllowedUrl(targetUrl: string): boolean {
    try {
      const parsed = new URL(targetUrl, this.allowedBaseUrl);
      const allowed = new URL(this.allowedBaseUrl);
      return (
        parsed.hostname === allowed.hostname &&
        parsed.port === allowed.port &&
        (parsed.protocol === 'http:' || parsed.protocol === 'https:')
      );
    } catch {
      return false;
    }
  }

  public async getPage(): Promise<Page> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      this.context = await this.browser.newContext({
        viewport: { width: 1280, height: 800 }
      });
      this.page = await this.context.newPage();
    }
    return this.page!;
  }

  public async openAllowedPage(pagePathOrUrl: string): Promise<{ url: string; title: string }> {
    let fullUrl = pagePathOrUrl;
    if (pagePathOrUrl.startsWith('/')) {
      fullUrl = `${this.allowedBaseUrl}${pagePathOrUrl}`;
    } else if (!pagePathOrUrl.startsWith('http')) {
      fullUrl = `${this.allowedBaseUrl}/${pagePathOrUrl}`;
    }

    if (!this.isAllowedUrl(fullUrl)) {
      throw new Error(`SECURITY_VIOLATION: Navigation to domain '${fullUrl}' is rejected. Browser is strictly restricted to '${this.allowedBaseUrl}'.`);
    }

    const page = await this.getPage();
    await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const title = await page.title();
    return { url: page.url(), title };
  }

  public async inspectPage(selector?: string): Promise<{ visibleText: string; elementCount?: number }> {
    const page = await this.getPage();
    if (selector) {
      const loc = page.locator(selector);
      const count = await loc.count();
      if (count === 0) {
        throw new Error(`SELECTOR_NOT_FOUND: Element with selector '${selector}' was not found on page.`);
      }
      const text = await loc.first().innerText();
      return { visibleText: text, elementCount: count };
    }

    const bodyText = await page.innerText('body');
    return { visibleText: bodyText.slice(0, 3000) }; // bounded text size
  }

  public async clickElement(selector: string): Promise<{ clicked: boolean; selector: string }> {
    const page = await this.getPage();
    const loc = page.locator(selector).first();
    await loc.waitFor({ state: 'visible', timeout: 10000 });
    await loc.click();
    return { clicked: true, selector };
  }

  public async fillField(selector: string, value: string): Promise<{ filled: boolean; selector: string; value: string }> {
    const page = await this.getPage();
    const loc = page.locator(selector).first();
    await loc.waitFor({ state: 'visible', timeout: 10000 });
    await loc.fill(value);
    return { filled: true, selector, value };
  }

  public async extractTable(tableSelector: string): Promise<{ headers: string[]; rows: string[][] }> {
    const page = await this.getPage();
    const table = page.locator(tableSelector).first();
    await table.waitFor({ state: 'visible', timeout: 10000 });
    // Allow rows to render
    await page.locator(`${tableSelector} tbody tr`).first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

    const headers = await table.locator('th').allInnerTexts();
    const rowLocators = await table.locator('tbody tr').all();
    const rows: string[][] = [];

    for (const row of rowLocators) {
      const cells = await row.locator('td').allInnerTexts();
      if (cells.length > 0) {
        rows.push(cells);
      }
    }

    return { headers, rows };
  }

  public async captureScreenshot(name = 'screenshot'): Promise<{ filename: string; relativePath: string }> {
    const page = await this.getPage();
    const timestamp = Date.now();
    const filename = `${name}_${timestamp}.png`;
    const fullPath = path.join(SCREENSHOTS_DIR, filename);

    await page.screenshot({ path: fullPath, fullPage: true });
    return {
      filename,
      relativePath: `/screenshots/${filename}`
    };
  }

  public async close(): Promise<void> {
    if (this.context) {
      await this.context.close().catch(() => {});
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
    this.page = null;
  }
}
