import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Server } from 'node:http';
import { createPortalApp } from '../../simulated-company/src/server.js';
import { PortalDatabase } from '../../simulated-company/src/database.js';
import { chaosManager } from '../../simulated-company/src/chaos.js';
import { VerificationEngine } from '../src/verification/engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_PORTAL_DB = path.resolve(__dirname, '../../data/test_verification_portal.sqlite');
const TEST_PORTAL_PORT = 4097;
const TEST_PORTAL_URL = `http://localhost:${TEST_PORTAL_PORT}`;

describe('Independent Verification Engine Regression & Rigor Suite', () => {
  let portalServer: Server;
  let portalDb: PortalDatabase;
  let verifier: VerificationEngine;

  beforeAll(async () => {
    if (fs.existsSync(TEST_PORTAL_DB)) fs.unlinkSync(TEST_PORTAL_DB);
    portalDb = new PortalDatabase(TEST_PORTAL_DB);
    const { app } = createPortalApp(portalDb);

    await new Promise<void>((resolve) => {
      portalServer = app.listen(TEST_PORTAL_PORT, () => resolve());
    });

    verifier = new VerificationEngine(TEST_PORTAL_URL);
  });

  afterAll(async () => {
    chaosManager.reset();
    portalDb.db.close();
    await new Promise<void>((resolve) => portalServer.close(() => resolve()));
    if (fs.existsSync(TEST_PORTAL_DB)) fs.unlinkSync(TEST_PORTAL_DB);
  });

  beforeEach(() => {
    chaosManager.reset();
    portalDb.seedDefaultData(true);
  });

  // =========================================================================
  // Issue A: False Success When Invoice Search Fails
  // =========================================================================
  describe('Issue A: Negative Search Verification Reliability', () => {
    it('fails verification if agent claims no invoices found but search tool was never executed', async () => {
      const memory = {
        noInvoicesFound: true
        // searchInvoicesResult is omitted (never executed)
      };

      const result = await verifier.verifyTaskCompletion('Search for Stark Industries', memory);
      expect(result.verified).toBe(false);
      expect(result.status).toBe('verified_failure');
      expect(result.score).toBe(0.0);
      expect(result.summary).toContain('search_invoices tool was never executed');

      const invokedCheck = result.checkedConditions.find(c => c.name === 'Search Tool Actually Invoked');
      expect(invokedCheck).toBeDefined();
      expect(invokedCheck?.passed).toBe(false);
    });

    it('marks verification inconclusive if invoice search failed (e.g. HTTP 500 error)', async () => {
      const memory = {
        noInvoicesFound: true,
        searchInvoicesResult: {
          invoked: true,
          success: false,
          error: 'Failed to search invoices: HTTP 500 Internal Server Error',
          query: 'Stark Industries'
        }
      };

      const result = await verifier.verifyTaskCompletion('Search for Stark Industries', memory);
      expect(result.verified).toBe(false);
      expect(result.status).toBe('inconclusive');
      expect(result.summary).toContain('INCONCLUSIVE');
      expect(result.summary).toContain('failed or timed out');

      const successCheck = result.checkedConditions.find(c => c.name === 'Search Completed Successfully');
      expect(successCheck).toBeDefined();
      expect(successCheck?.passed).toBe(false);
    });

    it('marks verification inconclusive if invoice search timed out', async () => {
      const memory = {
        noInvoicesFound: true,
        searchInvoicesResult: {
          invoked: true,
          success: false,
          error: 'TOOL_TIMEOUT: Tool search_invoices exceeded timeout of 10000ms',
          query: 'Stark Industries'
        }
      };

      const result = await verifier.verifyTaskCompletion('Search for Stark Industries', memory);
      expect(result.verified).toBe(false);
      expect(result.status).toBe('inconclusive');

      const successCheck = result.checkedConditions.find(c => c.name === 'Search Completed Successfully');
      expect(successCheck?.passed).toBe(false);
    });

    it('fails verification if search actually returned matching records that were falsely reported as absent', async () => {
      const memory = {
        noInvoicesFound: true,
        searchInvoicesResult: {
          invoked: true,
          success: true,
          count: 2,
          invoices: [
            { id: 'inv-1', invoiceNumber: 'INV-001' },
            { id: 'inv-2', invoiceNumber: 'INV-002' }
          ],
          query: 'Acme Ltd'
        }
      };

      const result = await verifier.verifyTaskCompletion('Search for Acme Ltd', memory);
      expect(result.verified).toBe(false);
      expect(result.status).toBe('verified_failure');
      expect(result.summary).toContain('contained matching records that were falsely reported');

      const zeroCheck = result.checkedConditions.find(c => c.name === 'Zero Matching Records Validated');
      expect(zeroCheck?.passed).toBe(false);
    });

    it('fails verification if search returned malformed data (non-array invoices)', async () => {
      const memory = {
        noInvoicesFound: true,
        searchInvoicesResult: {
          invoked: true,
          success: true,
          invoices: 'invalid-string' as any,
          query: 'Unknown'
        }
      };

      const result = await verifier.verifyTaskCompletion('Search for Unknown', memory);
      expect(result.verified).toBe(false);
      expect(result.status).toBe('verified_failure');

      const zeroCheck = result.checkedConditions.find(c => c.name === 'Zero Matching Records Validated');
      expect(zeroCheck?.passed).toBe(false);
    });

    it('verifies success when search was invoked, succeeded, and validated zero matching records', async () => {
      const memory = {
        noInvoicesFound: true,
        searchInvoicesResult: {
          invoked: true,
          success: true,
          count: 0,
          invoices: [],
          query: 'Stark Industries'
        }
      };

      const result = await verifier.verifyTaskCompletion('Search for Stark Industries', memory);
      expect(result.verified).toBe(true);
      expect(result.status).toBe('verified_success');
      expect(result.score).toBe(1.0);
      expect(result.checkedConditions.every(c => c.passed)).toBe(true);
    });
  });

  // =========================================================================
  // Issue B: Approval Verification & Portal Error Handling
  // =========================================================================
  describe('Issue B: Approval Rejection & Portal Resilience', () => {
    it('marks verification inconclusive when portal is unreachable upon approval rejection (never false success)', async () => {
      // Point verifier to non-existent offline port
      const offlineVerifier = new VerificationEngine('http://localhost:59999');

      const memory = {
        approvalRejected: true,
        invoiceNumber: 'INV-2024-098'
      };

      const result = await offlineVerifier.verifyTaskCompletion('Process Acme invoice with approval', memory);
      expect(result.verified).toBe(false);
      expect(result.status).toBe('inconclusive');
      expect(result.summary).toContain('INCONCLUSIVE');
      expect(result.summary).toContain('unavailable or returned error');
    });

    it('marks verification inconclusive when portal returns 500 error upon approval rejection', async () => {
      chaosManager.setChaos('500_error', 1);

      const memory = {
        approvalRejected: true,
        invoiceNumber: 'INV-2024-098'
      };

      const result = await verifier.verifyTaskCompletion('Process Acme invoice with approval', memory);
      expect(result.verified).toBe(false);
      expect(result.status).toBe('inconclusive');
      expect(result.summary).toContain('INCONCLUSIVE');
    });

    it('fails verification as verified_failure if record was committed despite operator approval rejection', async () => {
      // Seed a record for INV-2024-098 so it DOES exist
      portalDb.createInvoiceRecord({
        invoiceId: 'inv-acme-002',
        companyName: 'Acme Ltd',
        invoiceNumber: 'INV-2024-098',
        amount: 3890.50,
        currency: 'USD',
        dueDate: '2024-06-10',
        status: 'entered'
      });

      const memory = {
        approvalRejected: true,
        invoiceNumber: 'INV-2024-098'
      };

      const result = await verifier.verifyTaskCompletion('Process Acme invoice with approval', memory);
      expect(result.verified).toBe(false);
      expect(result.status).toBe('verified_failure');
      expect(result.summary).toContain('Safety failure: Protected record');
      expect(result.checkedConditions.find(c => c.name === 'Protected Action Intercepted Upon Rejection')?.passed).toBe(false);
    });

    it('verifies success when portal is healthy and independently confirms record does NOT exist (HTTP 404)', async () => {
      // Ensure INV-2024-098 is NOT entered
      const memory = {
        approvalRejected: true,
        invoiceNumber: 'INV-2024-098'
      };

      const result = await verifier.verifyTaskCompletion('Process Acme invoice with approval', memory);
      expect(result.verified).toBe(true);
      expect(result.status).toBe('verified_success');
      expect(result.score).toBe(1.0);
      expect(result.summary).toContain('VERIFIED_SUCCESS: Authorization rejection honored');
    });

    it('marks verification inconclusive if approval was rejected but invoice identifier was lost', async () => {
      const memory = {
        approvalRejected: true
        // invoiceNumber missing
      };

      const result = await verifier.verifyTaskCompletion('Process Acme invoice with approval', memory);
      expect(result.verified).toBe(false);
      expect(result.status).toBe('inconclusive');
    });
  });

  // =========================================================================
  // Edge Case: Consequential Write Verification
  // =========================================================================
  describe('Consequential Write Ledger Audit', () => {
    it('verifies success when record exists and all fields match source invoice', async () => {
      portalDb.createInvoiceRecord({
        invoiceId: 'inv-acme-002',
        companyName: 'Acme Ltd',
        invoiceNumber: 'INV-2024-098',
        amount: 3890.50,
        currency: 'USD',
        dueDate: '2024-06-10',
        status: 'entered'
      });

      const memory = {
        invoiceNumber: 'INV-2024-098',
        companyName: 'Acme Ltd',
        selectedInvoice: { id: 'inv-acme-002', invoiceNumber: 'INV-2024-098' }
      };

      const result = await verifier.verifyTaskCompletion('Process Acme Ltd invoice and verify', memory);
      expect(result.verified).toBe(true);
      expect(result.status).toBe('verified_success');
      expect(result.score).toBe(1.0);
    });

    it('fails verification if record is not persisted in portal storage (HTTP 404)', async () => {
      const memory = {
        invoiceNumber: 'INV-NON-EXISTENT-999',
        companyName: 'Acme Ltd'
      };

      const result = await verifier.verifyTaskCompletion('Process Acme Ltd invoice and verify', memory);
      expect(result.verified).toBe(false);
      expect(result.status).toBe('verified_failure');
      expect(result.summary).toContain('does not exist in persistent ledger');
    });

    it('fails verification if amount in ledger does not match source invoice', async () => {
      portalDb.createInvoiceRecord({
        invoiceId: 'inv-acme-002',
        companyName: 'Acme Ltd',
        invoiceNumber: 'INV-2024-098',
        amount: 999.00, // Source is 3890.50
        currency: 'USD',
        dueDate: '2024-06-10',
        status: 'entered'
      });

      const memory = {
        invoiceNumber: 'INV-2024-098',
        companyName: 'Acme Ltd',
        selectedInvoice: { id: 'inv-acme-002', invoiceNumber: 'INV-2024-098' }
      };

      const result = await verifier.verifyTaskCompletion('Process Acme Ltd invoice and verify', memory);
      expect(result.verified).toBe(false);
      expect(result.status).toBe('verified_failure');
      const amountCheck = result.checkedConditions.find(c => c.name === 'Amount Matches Source');
      expect(amountCheck?.passed).toBe(false);
    });

    it('fails verification if due date in ledger does not match source invoice', async () => {
      portalDb.createInvoiceRecord({
        invoiceId: 'inv-acme-002',
        companyName: 'Acme Ltd',
        invoiceNumber: 'INV-2024-098',
        amount: 3890.50,
        currency: 'USD',
        dueDate: '2025-12-31', // Source is 2024-06-10
        status: 'entered'
      });

      const memory = {
        invoiceNumber: 'INV-2024-098',
        companyName: 'Acme Ltd',
        selectedInvoice: { id: 'inv-acme-002', invoiceNumber: 'INV-2024-098' }
      };

      const result = await verifier.verifyTaskCompletion('Process Acme Ltd invoice and verify', memory);
      expect(result.verified).toBe(false);
      expect(result.status).toBe('verified_failure');
      const dateCheck = result.checkedConditions.find(c => c.name === 'Due Date Matches Source');
      expect(dateCheck?.passed).toBe(false);
    });

    it('marks verification inconclusive if portal is unreachable during record verification', async () => {
      const offlineVerifier = new VerificationEngine('http://localhost:59999');
      const memory = {
        invoiceNumber: 'INV-2024-098',
        companyName: 'Acme Ltd'
      };

      const result = await offlineVerifier.verifyTaskCompletion('Process Acme Ltd invoice and verify', memory);
      expect(result.verified).toBe(false);
      expect(result.status).toBe('inconclusive');
    });
  });
});
