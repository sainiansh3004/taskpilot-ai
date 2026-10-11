import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { PortalDatabase } from './database.js';
import { chaosManager } from './chaos.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createPortalApp(dbInstance?: PortalDatabase) {
  const app = express();
  const db = dbInstance || new PortalDatabase();

  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.resolve(__dirname, 'public')));

  // Middleware for chaos failure simulation
  app.use('/api', (req, res, next) => {
    // Exclude chaos status and reset endpoints from failing
    if (req.path.startsWith('/chaos') || req.path.startsWith('/reset') || req.path === '/health') {
      return next();
    }

    const chaos = chaosManager.shouldFail();
    if (!chaos.fail) {
      return next();
    }

    if (chaos.mode === '500_error') {
      return res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Simulated transient database gateway error (Chaos active).',
        remainingFailures: chaos.remaining
      });
    }

    if (chaos.mode === 'rate_limit') {
      return res.status(429).json({
        error: 'TOO_MANY_REQUESTS',
        message: 'Simulated rate limit encountered. Please backoff.',
        remainingFailures: chaos.remaining
      });
    }

    if (chaos.mode === 'timeout') {
      // Simulate timeout delay
      setTimeout(() => {
        if (!res.headersSent) {
          res.status(504).json({
            error: 'GATEWAY_TIMEOUT',
            message: 'Simulated backend timeout delay exceeded.',
            remainingFailures: chaos.remaining
          });
        }
      }, 4000);
      return;
    }

    next();
  });

  // Health check
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'simulated-company-portal',
      timestamp: new Date().toISOString()
    });
  });

  // Invoices API
  app.get('/api/invoices', (req, res) => {
    try {
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const invoices = db.getInvoices(search);
      res.json({ success: true, count: invoices.length, invoices });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/invoices/:id', (req, res) => {
    try {
      const invoice = db.getInvoiceById(req.params.id);
      if (!invoice) {
        return res.status(404).json({ success: false, error: `Invoice with ID '${req.params.id}' not found.` });
      }
      res.json({ success: true, invoice });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Invoice Records (Entered internal ledger)
  app.get('/api/records', (_req, res) => {
    try {
      const records = db.getInvoiceRecords();
      res.json({ success: true, count: records.length, records });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/records/:invoiceNumber', (req, res) => {
    try {
      const record = db.getInvoiceRecordByNumber(req.params.invoiceNumber);
      if (!record) {
        return res.status(404).json({ success: false, error: `No entered record found for invoice number '${req.params.invoiceNumber}'.` });
      }
      res.json({ success: true, record });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  const CreateRecordSchema = z.object({
    invoiceId: z.string().min(1, 'Invoice ID is required'),
    companyName: z.string().min(1, 'Company Name is required'),
    invoiceNumber: z.string().min(1, 'Invoice Number is required'),
    amount: z.number().positive('Amount must be positive'),
    currency: z.string().default('USD'),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be YYYY-MM-DD'),
    notes: z.string().optional()
  });

  app.post('/api/records', (req, res) => {
    try {
      const parsed = CreateRecordSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          details: parsed.error.issues
        });
      }

      // Check if source invoice exists
      const sourceInvoice = db.getInvoiceById(parsed.data.invoiceId);
      if (!sourceInvoice) {
        return res.status(404).json({
          success: false,
          error: 'SOURCE_INVOICE_NOT_FOUND',
          message: `Source invoice '${parsed.data.invoiceId}' does not exist.`
        });
      }

      // Duplicate check
      const existing = db.getInvoiceRecordByNumber(parsed.data.invoiceNumber);
      if (existing) {
        return res.status(409).json({
          success: false,
          error: 'DUPLICATE_RECORD',
          message: `Invoice '${parsed.data.invoiceNumber}' is already entered into the system (Record ID: ${existing.id}).`,
          existingRecord: existing
        });
      }

      const created = db.createInvoiceRecord({
        invoiceId: parsed.data.invoiceId,
        companyName: parsed.data.companyName,
        invoiceNumber: parsed.data.invoiceNumber,
        amount: parsed.data.amount,
        currency: parsed.data.currency,
        dueDate: parsed.data.dueDate,
        status: 'entered',
        notes: parsed.data.notes || ''
      });

      res.status(201).json({
        success: true,
        message: 'Invoice record successfully entered and recorded.',
        record: created
      });
    } catch (err: any) {
      if (err.message && err.message.includes('DUPLICATE_RECORD')) {
        return res.status(409).json({ success: false, error: 'DUPLICATE_RECORD', message: err.message });
      }
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Chaos API
  app.post('/api/chaos', (req, res) => {
    const { failMode, count } = req.body;
    chaosManager.setChaos(failMode || 'none', Number(count) || 0);
    res.json({
      success: true,
      chaos: chaosManager.getStatus()
    });
  });

  app.get('/api/chaos', (_req, res) => {
    res.json({ success: true, chaos: chaosManager.getStatus() });
  });

  // Reset database state API
  app.post('/api/reset', (_req, res) => {
    chaosManager.reset();
    db.seedDefaultData(true);
    res.json({ success: true, message: 'Database reset to default seed data successfully.' });
  });

  return { app, db };
}

// Standalone runner
if (process.env.NODE_ENV !== 'test') {
  const PORT = parseInt(process.env.SIMULATED_PORTAL_PORT || '4001', 10);
  const { app } = createPortalApp();
  app.listen(PORT, () => {
    console.log(`[Simulated Enterprise Portal] Running at http://localhost:${PORT}`);
  });
}
