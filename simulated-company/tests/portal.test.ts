import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PortalDatabase } from '../src/database.js';
import { chaosManager } from '../src/chaos.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_DB_PATH = path.resolve(__dirname, '../../data/test_simulated_portal.sqlite');

describe('Simulated Company Portal Database & Logic', () => {
  let db: PortalDatabase;

  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    db = new PortalDatabase(TEST_DB_PATH);
    chaosManager.reset();
  });

  afterEach(() => {
    db.db.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  it('initializes schema and seeds default invoices', () => {
    const invoices = db.getInvoices();
    expect(invoices.length).toBeGreaterThanOrEqual(7);

    const acmeInvoices = invoices.filter(i => i.companyName === 'Acme Ltd');
    expect(acmeInvoices.length).toBe(2);

    // Verify ordering by issue date descending (latest first)
    expect(acmeInvoices[0].invoiceNumber).toBe('INV-2024-098');
    expect(acmeInvoices[0].amount).toBe(3890.50);
  });

  it('searches invoices by company name or number', () => {
    const results = db.getInvoices('Acme');
    expect(results.length).toBe(2);
    expect(results.every(i => i.companyName.includes('Acme'))).toBe(true);

    const specific = db.getInvoices('INV-2024-104');
    expect(specific.length).toBe(1);
    expect(specific[0].companyName).toBe('Globex Corp');
  });

  it('successfully creates an invoice record in the ledger', () => {
    const record = db.createInvoiceRecord({
      invoiceId: 'inv-acme-002',
      companyName: 'Acme Ltd',
      invoiceNumber: 'INV-2024-098',
      amount: 3890.50,
      currency: 'USD',
      dueDate: '2024-06-10',
      status: 'entered',
      notes: 'Test creation'
    });

    expect(record.id).toBeDefined();
    expect(record.createdAt).toBeDefined();
    expect(record.invoiceNumber).toBe('INV-2024-098');

    const fetched = db.getInvoiceRecordByNumber('INV-2024-098');
    expect(fetched).not.toBeNull();
    expect(fetched?.amount).toBe(3890.50);
  });

  it('rejects duplicate record creation with DUPLICATE_RECORD error', () => {
    // Pre-seeded Umbrella Inc invoice record exists
    expect(() => {
      db.createInvoiceRecord({
        invoiceId: 'inv-umbrella-301',
        companyName: 'Umbrella Inc',
        invoiceNumber: 'INV-2024-301',
        amount: 12300.00,
        currency: 'USD',
        dueDate: '2024-03-01',
        status: 'entered'
      });
    }).toThrowError(/DUPLICATE_RECORD/);
  });

  it('handles chaos manager failure states and recovery', () => {
    chaosManager.setChaos('500_error', 2);
    
    // 1st request should fail
    const first = chaosManager.shouldFail();
    expect(first.fail).toBe(true);
    expect(first.mode).toBe('500_error');
    expect(first.remaining).toBe(1);

    // 2nd request should fail
    const second = chaosManager.shouldFail();
    expect(second.fail).toBe(true);
    expect(second.mode).toBe('500_error');
    expect(second.remaining).toBe(0);

    // 3rd request should succeed (recovered!)
    const third = chaosManager.shouldFail();
    expect(third.fail).toBe(false);
    expect(third.mode).toBe('none');
  });
});
