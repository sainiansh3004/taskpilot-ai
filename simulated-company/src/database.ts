import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Invoice, InvoiceRecord } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class PortalDatabase {
  public db: Database.Database;

  constructor(dbPath?: string) {
    const resolvedPath = dbPath || process.env.PORTAL_DATABASE_PATH || path.resolve(__dirname, '../../data/simulated_company.sqlite');
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(resolvedPath);
    this.db.pragma('journal_mode = WAL');
    this.initSchema();
    this.seedDefaultData();
  }

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        company_name TEXT NOT NULL,
        invoice_number TEXT NOT NULL UNIQUE,
        issue_date TEXT NOT NULL,
        due_date TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        status TEXT NOT NULL DEFAULT 'pending',
        description TEXT NOT NULL,
        line_items_json TEXT NOT NULL DEFAULT '[]',
        missing_fields_json TEXT NOT NULL DEFAULT '[]'
      );

      CREATE TABLE IF NOT EXISTS invoice_records (
        id TEXT PRIMARY KEY,
        invoice_id TEXT NOT NULL,
        company_name TEXT NOT NULL,
        invoice_number TEXT NOT NULL UNIQUE,
        amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        due_date TEXT NOT NULL,
        created_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'entered',
        notes TEXT DEFAULT ''
      );
    `);
  }

  public seedDefaultData(forceReset = false) {
    const count = this.db.prepare('SELECT COUNT(*) as cnt FROM invoices').get() as { cnt: number };
    if (count.cnt > 0 && !forceReset) {
      return;
    }

    if (forceReset) {
      this.db.exec('DELETE FROM invoice_records; DELETE FROM invoices;');
    }

    const insertInvoice = this.db.prepare(`
      INSERT INTO invoices (
        id, company_name, invoice_number, issue_date, due_date,
        amount, currency, status, description, line_items_json, missing_fields_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const defaultInvoices: Invoice[] = [
      {
        id: 'inv-acme-001',
        companyName: 'Acme Ltd',
        invoiceNumber: 'INV-2024-012',
        issueDate: '2024-01-15',
        dueDate: '2024-02-15',
        amount: 1450.00,
        currency: 'USD',
        status: 'paid',
        description: 'Q1 Consulting and Cloud Infrastructure Support',
        lineItems: [
          { description: 'Cloud Architecture Advisory', quantity: 10, unitPrice: 100, total: 1000 },
          { description: 'Security Hardening Session', quantity: 3, unitPrice: 150, total: 450 }
        ]
      },
      {
        id: 'inv-acme-002',
        companyName: 'Acme Ltd',
        invoiceNumber: 'INV-2024-098',
        issueDate: '2024-05-10',
        dueDate: '2024-06-10',
        amount: 3890.50,
        currency: 'USD',
        status: 'pending',
        description: 'Latest Q2 Enterprise AI Gateway Implementation and API Tier',
        lineItems: [
          { description: 'Enterprise LLM Router Configuration', quantity: 1, unitPrice: 2500, total: 2500 },
          { description: 'Telemetry and Latency Optimization', quantity: 9.27, unitPrice: 150, total: 1390.50 }
        ]
      },
      {
        id: 'inv-globex-101',
        companyName: 'Globex Corp',
        invoiceNumber: 'INV-2024-104',
        issueDate: '2024-04-01',
        dueDate: '2024-05-01',
        amount: 5200.00,
        currency: 'USD',
        status: 'approved',
        description: 'Enterprise Security Assessment and Red Team Drill',
        lineItems: [
          { description: 'Penetration Testing Scope A', quantity: 1, unitPrice: 5200, total: 5200 }
        ]
      },
      {
        id: 'inv-initech-201',
        companyName: 'Initech LLC',
        invoiceNumber: 'INV-2024-205',
        issueDate: '2024-03-20',
        dueDate: '2024-04-20',
        amount: 750.25,
        currency: 'USD',
        status: 'pending',
        description: 'TPS Report Automation Scripts and Tooling',
        lineItems: [
          { description: 'Report Engine Scripting', quantity: 5, unitPrice: 150.05, total: 750.25 }
        ]
      },
      {
        id: 'inv-umbrella-301',
        companyName: 'Umbrella Inc',
        invoiceNumber: 'INV-2024-301',
        issueDate: '2024-02-01',
        dueDate: '2024-03-01',
        amount: 12300.00,
        currency: 'USD',
        status: 'pending',
        description: 'Biochemical Lab Diagnostics Software License',
        lineItems: [
          { description: 'Annual Multi-Seat Enterprise License', quantity: 1, unitPrice: 12300, total: 12300 }
        ]
      },
      {
        id: 'inv-wayne-401',
        companyName: 'Wayne Enterprises',
        invoiceNumber: 'INV-2024-401',
        issueDate: '2024-05-01',
        dueDate: '',
        amount: 9999.00,
        currency: 'USD',
        status: 'pending',
        description: 'Batmobile Telemetry Subsystem Maintenance (Incomplete Due Date)',
        lineItems: [
          { description: 'Aero Dynamics Telemetry Upgrade', quantity: 1, unitPrice: 9999, total: 9999 }
        ],
        missingFields: ['dueDate']
      },
      {
        id: 'inv-nova-501',
        companyName: 'Nova Dynamics Ltd',
        invoiceNumber: 'INV-2024-501',
        issueDate: '2024-06-01',
        dueDate: '2024-07-01',
        amount: 4100.00,
        currency: 'USD',
        status: 'pending',
        description: 'Regional Robotics Integration',
        lineItems: [
          { description: 'Actuator Integration Firmware', quantity: 1, unitPrice: 4100, total: 4100 }
        ]
      },
      {
        id: 'inv-nova-502',
        companyName: 'Nova Dynamics Global',
        invoiceNumber: 'INV-2024-502',
        issueDate: '2024-06-05',
        dueDate: '2024-07-05',
        amount: 8800.00,
        currency: 'USD',
        status: 'pending',
        description: 'Global Robotics Maintenance and Calibration',
        lineItems: [
          { description: 'Fleet Calibration Kit', quantity: 1, unitPrice: 8800, total: 8800 }
        ]
      }
    ];

    const insertTx = this.db.transaction((invoices: Invoice[]) => {
      for (const inv of invoices) {
        insertInvoice.run(
          inv.id,
          inv.companyName,
          inv.invoiceNumber,
          inv.issueDate,
          inv.dueDate,
          inv.amount,
          inv.currency,
          inv.status,
          inv.description,
          JSON.stringify(inv.lineItems),
          JSON.stringify(inv.missingFields || [])
        );
      }
    });

    insertTx(defaultInvoices);

    // Seed one existing invoice record for Umbrella Inc to test duplicate detection!
    const insertRecord = this.db.prepare(`
      INSERT INTO invoice_records (
        id, invoice_id, company_name, invoice_number, amount, currency, due_date, created_at, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertRecord.run(
      'rec-existing-umbrella',
      'inv-umbrella-301',
      'Umbrella Inc',
      'INV-2024-301',
      12300.00,
      'USD',
      '2024-03-01',
      '2024-02-05T10:00:00Z',
      'entered',
      'Pre-existing entered record in system'
    );
  }

  public getInvoices(search?: string): Invoice[] {
    let query = 'SELECT * FROM invoices';
    const params: string[] = [];

    if (search && search.trim().length > 0) {
      query += ' WHERE company_name LIKE ? OR invoice_number LIKE ? OR description LIKE ?';
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    query += ' ORDER BY issue_date DESC';

    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map((r) => ({
      id: r.id,
      companyName: r.company_name,
      invoiceNumber: r.invoice_number,
      issueDate: r.issue_date,
      dueDate: r.due_date,
      amount: r.amount,
      currency: r.currency,
      status: r.status,
      description: r.description,
      lineItems: JSON.parse(r.line_items_json || '[]'),
      missingFields: JSON.parse(r.missing_fields_json || '[]')
    }));
  }

  public getInvoiceById(id: string): Invoice | null {
    const row = this.db.prepare('SELECT * FROM invoices WHERE id = ?').get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      companyName: row.company_name,
      invoiceNumber: row.invoice_number,
      issueDate: row.issue_date,
      dueDate: row.due_date,
      amount: row.amount,
      currency: row.currency,
      status: row.status,
      description: row.description,
      lineItems: JSON.parse(row.line_items_json || '[]'),
      missingFields: JSON.parse(row.missing_fields_json || '[]')
    };
  }

  public getInvoiceByNumber(invNum: string): Invoice | null {
    const row = this.db.prepare('SELECT * FROM invoices WHERE invoice_number = ?').get(invNum) as any;
    if (!row) return null;
    return {
      id: row.id,
      companyName: row.company_name,
      invoiceNumber: row.invoice_number,
      issueDate: row.issue_date,
      dueDate: row.due_date,
      amount: row.amount,
      currency: row.currency,
      status: row.status,
      description: row.description,
      lineItems: JSON.parse(row.line_items_json || '[]'),
      missingFields: JSON.parse(row.missing_fields_json || '[]')
    };
  }

  public getInvoiceRecords(): InvoiceRecord[] {
    const rows = this.db.prepare('SELECT * FROM invoice_records ORDER BY created_at DESC').all() as any[];
    return rows.map((r) => ({
      id: r.id,
      invoiceId: r.invoice_id,
      companyName: r.company_name,
      invoiceNumber: r.invoice_number,
      amount: r.amount,
      currency: r.currency,
      dueDate: r.due_date,
      createdAt: r.created_at,
      status: r.status,
      notes: r.notes || ''
    }));
  }

  public getInvoiceRecordByNumber(invoiceNumber: string): InvoiceRecord | null {
    const row = this.db.prepare('SELECT * FROM invoice_records WHERE invoice_number = ?').get(invoiceNumber) as any;
    if (!row) return null;
    return {
      id: row.id,
      invoiceId: row.invoice_id,
      companyName: row.company_name,
      invoiceNumber: row.invoice_number,
      amount: row.amount,
      currency: row.currency,
      dueDate: row.due_date,
      createdAt: row.created_at,
      status: row.status,
      notes: row.notes || ''
    };
  }

  public createInvoiceRecord(record: Omit<InvoiceRecord, 'id' | 'createdAt'>): InvoiceRecord {
    // Check for duplicate invoiceNumber
    const existing = this.getInvoiceRecordByNumber(record.invoiceNumber);
    if (existing) {
      throw new Error(`DUPLICATE_RECORD: An invoice record with number '${record.invoiceNumber}' already exists (Record ID: ${existing.id}).`);
    }

    const id = `rec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const createdAt = new Date().toISOString();

    const insert = this.db.prepare(`
      INSERT INTO invoice_records (
        id, invoice_id, company_name, invoice_number, amount, currency, due_date, created_at, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insert.run(
      id,
      record.invoiceId,
      record.companyName,
      record.invoiceNumber,
      record.amount,
      record.currency || 'USD',
      record.dueDate,
      createdAt,
      record.status || 'entered',
      record.notes || ''
    );

    return {
      id,
      createdAt,
      ...record
    };
  }
}
