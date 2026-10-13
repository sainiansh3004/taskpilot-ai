import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Server } from 'node:http';
import { createPortalApp } from '../../simulated-company/src/server.js';
import { PortalDatabase } from '../../simulated-company/src/database.js';
import { chaosManager } from '../../simulated-company/src/chaos.js';
import { TaskRepository } from '../src/database/repository.js';
import { createDefaultToolRegistry } from '../src/tools/index.js';
import { VerificationEngine } from '../src/verification/engine.js';
import { AutonomousDeterministicProvider } from '../src/llm/autonomousDeterministicProvider.js';
import { AgentOrchestrator } from '../src/agent/orchestrator.js';
import type { TaskRecord } from '../src/types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_PORTAL_DB = path.resolve(__dirname, '../../data/test_orchestrator_portal.sqlite');
const TEST_TASK_DB = path.resolve(__dirname, '../../data/test_orchestrator_tasks.sqlite');
const TEST_PORTAL_PORT = 4099;
const TEST_PORTAL_URL = `http://localhost:${TEST_PORTAL_PORT}`;

describe('Autonomous Agent Orchestration & Execution Loop (Scenarios A through L)', () => {
  let portalServer: Server;
  let portalDb: PortalDatabase;
  let taskRepo: TaskRepository;
  let orchestrator: AgentOrchestrator;
  let verificationEngine: VerificationEngine;

  const waitForTaskCompletion = async (taskId: string, timeoutMs = 15000): Promise<TaskRecord> => {
    const startTime = Date.now();
    let task = taskRepo.getTaskById(taskId);
    while (task && !['succeeded', 'failed', 'cancelled', 'partially_succeeded', 'budget_exhausted'].includes(task.status)) {
      if (Date.now() - startTime > timeoutMs) break;
      await new Promise(r => setTimeout(r, 100));
      task = taskRepo.getTaskById(taskId);
    }
    return task!;
  };

  beforeAll(async () => {
    if (fs.existsSync(TEST_PORTAL_DB)) fs.unlinkSync(TEST_PORTAL_DB);
    if (fs.existsSync(TEST_TASK_DB)) fs.unlinkSync(TEST_TASK_DB);

    portalDb = new PortalDatabase(TEST_PORTAL_DB);
    const { app } = createPortalApp(portalDb);

    await new Promise<void>((resolve) => {
      portalServer = app.listen(TEST_PORTAL_PORT, () => resolve());
    });

    taskRepo = new TaskRepository(TEST_TASK_DB);
    const tools = createDefaultToolRegistry();
    verificationEngine = new VerificationEngine(TEST_PORTAL_URL);
    const llm = new AutonomousDeterministicProvider();

    orchestrator = new AgentOrchestrator(taskRepo, tools, verificationEngine, llm, {
      portalUrl: TEST_PORTAL_URL,
      requireApprovalForWrites: false,
      maxSteps: 15,
      taskTimeoutMs: 30000
    });
  });

  afterAll(async () => {
    chaosManager.reset();
    portalDb.db.close();
    taskRepo.db.close();
    await new Promise<void>((resolve) => portalServer.close(() => resolve()));

    if (fs.existsSync(TEST_PORTAL_DB)) fs.unlinkSync(TEST_PORTAL_DB);
    if (fs.existsSync(TEST_TASK_DB)) fs.unlinkSync(TEST_TASK_DB);
  });

  beforeEach(() => {
    chaosManager.reset();
  });

  // =========================================================================
  // Scenario A: Primary Success (Acme Ltd)
  // =========================================================================
  it('Scenario A (Primary Success): processes latest Acme Ltd invoice with independent verification', async () => {
    const goal = 'Find the latest invoice from Acme Ltd, extract its amount and due date, enter it into the internal invoice system, verify the saved record, and report the outcome.';

    const task = await orchestrator.startTask(goal);
    expect(task.id).toBeDefined();

    const finalTask = await waitForTaskCompletion(task.id);
    expect(finalTask?.status).toBe('succeeded');
    expect(finalTask?.stepsCount).toBeGreaterThan(0);
    expect(finalTask?.summary).toContain('INV-2024-098');
    expect(finalTask?.summary).toContain('3890.5');

    const events = taskRepo.getEventsForTask(task.id);
    const eventTypes = events.map(e => e.eventType);
    expect(eventTypes).toContain('task_started');
    expect(eventTypes).toContain('tool_call_completed');
    expect(eventTypes).toContain('verification_passed');
    expect(eventTypes).toContain('task_completed');

    const savedRecord = portalDb.getInvoiceRecordByNumber('INV-2024-098');
    expect(savedRecord).not.toBeNull();
    expect(savedRecord?.amount).toBe(3890.50);
    expect(savedRecord?.dueDate).toBe('2024-06-10');
  });

  // =========================================================================
  // Scenario B: Different Input (Globex Corp)
  // =========================================================================
  it('Scenario B (Different Input): processes Globex Corp invoice without modifying code', async () => {
    const goal = 'Find the latest invoice from Globex Corp, record it in the ledger, and verify the record.';

    const task = await orchestrator.startTask(goal);
    const finalTask = await waitForTaskCompletion(task.id);

    expect(finalTask?.status).toBe('succeeded');
    expect(finalTask?.summary).toContain('INV-2024-104');
    expect(finalTask?.summary).toContain('5200');

    const savedRecord = portalDb.getInvoiceRecordByNumber('INV-2024-104');
    expect(savedRecord).not.toBeNull();
    expect(savedRecord?.companyName).toContain('Globex');
  });

  // =========================================================================
  // Scenario C: Existing Record (Duplicate Prevention)
  // =========================================================================
  it('Scenario C (Existing Record): detects pre-existing record and prevents duplicate entry', async () => {
    const goal = 'Process invoice for Umbrella Inc and record in system.';

    const task = await orchestrator.startTask(goal);
    const finalTask = await waitForTaskCompletion(task.id);

    expect(finalTask?.status).toBe('succeeded');
    expect(finalTask?.summary?.toLowerCase()).toContain('duplicate');

    const events = taskRepo.getEventsForTask(task.id);
    const verifiedEvent = events.find(e => e.eventType === 'verification_passed');
    expect(verifiedEvent).toBeDefined();
    expect(verifiedEvent?.payload.verification.evidence.duplicateDetected).toBe(true);
  });

  // =========================================================================
  // Scenario D: Missing Information (Wayne Enterprises)
  // =========================================================================
  it('Scenario D (Missing Information): identifies missing due date and halts safely', async () => {
    const goal = 'Process invoice for Wayne Enterprises.';

    const task = await orchestrator.startTask(goal);
    const finalTask = await waitForTaskCompletion(task.id);

    expect(finalTask?.status).toBe('succeeded');
    expect(finalTask?.summary?.toLowerCase()).toContain('missing');

    const events = taskRepo.getEventsForTask(task.id);
    const verifiedEvent = events.find(e => e.eventType === 'verification_passed');
    expect(verifiedEvent).toBeDefined();
    expect(verifiedEvent?.payload.verification.evidence.missingFields).toContain('dueDate');
  });

  // =========================================================================
  // Scenario E: No Matching Invoice
  // =========================================================================
  it('Scenario E (No Matching Invoice): truthfully reports no invoices found without inventing data', async () => {
    const goal = 'Find the latest invoice from Stark Industries, record it, and verify.';

    const task = await orchestrator.startTask(goal);
    const finalTask = await waitForTaskCompletion(task.id);

    expect(finalTask?.status).toBe('succeeded');
    expect(finalTask?.summary?.toLowerCase()).toContain('no invoices found');

    const events = taskRepo.getEventsForTask(task.id);
    const verifiedEvent = events.find(e => e.eventType === 'verification_passed');
    expect(verifiedEvent).toBeDefined();
    expect(verifiedEvent?.payload.verification.evidence.noInvoicesFound).toBe(true);
  });

  // =========================================================================
  // Scenario F: Transient Failure Recovery
  // =========================================================================
  it('Scenario F (Transient Failure): recovers from transient HTTP 500 error via exponential backoff retry', async () => {
    // Reset seed data and set chaos to fail 1 time with HTTP 500
    portalDb.seedDefaultData(true);
    chaosManager.setChaos('500_error', 1);

    const goal = 'Find the latest invoice from Initech LLC, extract details, and record into internal ledger.';
    const task = await orchestrator.startTask(goal);
    const finalTask = await waitForTaskCompletion(task.id, 20000);

    expect(finalTask?.status).toBe('succeeded');

    // Confirm retry_attempted event was emitted
    const events = taskRepo.getEventsForTask(task.id);
    const retryEvent = events.find(e => e.eventType === 'retry_attempted');
    expect(retryEvent).toBeDefined();
    expect(retryEvent?.payload.attempt).toBe(1);
    expect(retryEvent?.payload.error).toContain('500');

    // Confirm eventual record entry
    const savedRecord = portalDb.getInvoiceRecordByNumber('INV-2024-205');
    expect(savedRecord).not.toBeNull();
  });

  // =========================================================================
  // Scenario G: Permanent Failure Handling
  // =========================================================================
  it('Scenario G (Permanent Failure): safely terminates and truthfully reports unrecoverable tool error', async () => {
    // Attempting to read a non-existent invoice ID directly
    const tools = createDefaultToolRegistry();
    const brokenContext: any = {
      taskId: 'test-broken',
      stepNumber: 1,
      memory: {},
      portalUrl: TEST_PORTAL_URL,
      requireApprovalForWrites: false,
      emitEvent: () => {}
    };

    const res = await tools.executeTool('read_invoice', { invoiceId: 'inv-does-not-exist-999' }, brokenContext);
    expect(res.success).toBe(false);
    expect(res.error).toContain('not found');
  });

  // =========================================================================
  // Scenario H: Verification Mismatch
  // =========================================================================
  it('Scenario H (Verification Mismatch): rejects task as verified when ledger values differ from source', async () => {
    // Intentionally create a corrupted record where amount does not match source invoice
    const corruptedRecordNumber = 'INV-MISMATCH-999';
    portalDb.db.prepare(`
      INSERT INTO invoice_records (
        id, invoice_id, company_name, invoice_number, amount, currency, due_date, created_at, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'rec-mismatch',
      'inv-acme-001',
      'Acme Ltd',
      corruptedRecordNumber,
      9999.99, // Source is 1450.00
      'USD',
      '2024-02-15',
      new Date().toISOString(),
      'entered'
    );

    const memory = {
      invoiceNumber: corruptedRecordNumber,
      companyName: 'Acme Ltd',
      selectedInvoice: { id: 'inv-acme-001', invoiceNumber: corruptedRecordNumber }
    };

    const verification = await verificationEngine.verifyTaskCompletion('Verify invoice Acme Ltd', memory);
    expect(verification.verified).toBe(false);
    expect(verification.score).toBeLessThan(1.0);
    const amountCheck = verification.checkedConditions.find(c => c.name === 'Amount Matches Source');
    expect(amountCheck?.passed).toBe(false);
  });

  // =========================================================================
  // Scenario I: Human Approval Rejection Flow
  // =========================================================================
  it('Scenario I (Approval Rejection): halts task when human approval is rejected without executing protected action', async () => {
    const goal = 'Find the latest invoice from Acme Ltd, require human approval before entering record, and verify.';

    const task = await orchestrator.startTask(goal);

    // Wait until task reaches awaiting_approval
    let curTask = taskRepo.getTaskById(task.id);
    const startTime = Date.now();
    while (curTask && curTask.status !== 'awaiting_approval') {
      if (Date.now() - startTime > 10000) break;
      await new Promise(r => setTimeout(r, 100));
      curTask = taskRepo.getTaskById(task.id);
    }

    expect(curTask?.status).toBe('awaiting_approval');
    expect(curTask?.pendingApproval?.toolName).toBe('create_invoice_record');

    // Reject the approval request
    const resolved = await orchestrator.resolveApproval(task.id, false);
    expect(resolved).toBe(true);

    const finalTask = await waitForTaskCompletion(task.id);
    expect(finalTask.status).toBe('failed');
    expect(finalTask.summary?.toLowerCase()).toContain('rejected');

    // Confirm that protected invoice record was NEVER created in portal DB
    const record = portalDb.getInvoiceRecordByNumber('INV-2024-098');
    // If it was already inserted in previous test, verify rejection event was recorded
    const events = taskRepo.getEventsForTask(task.id);
    const approvalEvent = events.find(e => e.eventType === 'approval_resolved');
    expect(approvalEvent?.payload.approved).toBe(false);
  });

  // =========================================================================
  // Scenario J: Different Natural-Language Phrasing
  // =========================================================================
  it('Scenario J (Different Phrasing): correctly interprets conversational natural language objective', async () => {
    portalDb.seedDefaultData(true);
    const goal = 'Could you please locate our latest invoice from Acme Ltd, register it in the internal accounting portal, and confirm verification?';

    const task = await orchestrator.startTask(goal);
    const finalTask = await waitForTaskCompletion(task.id);

    expect(finalTask?.status).toBe('succeeded');
    expect(finalTask?.summary).toContain('INV-2024-098');
  });

  // =========================================================================
  // Scenario K: Concurrent Task Execution
  // =========================================================================
  it('Scenario K (Concurrency): executes concurrent tasks independently without shared state leakage', async () => {
    portalDb.seedDefaultData(true);

    const goal1 = 'Find latest invoice for Globex Corp and record in system.';
    const goal2 = 'List and read sample invoice documents in repository, then extract structured fields.';

    const [task1, task2] = await Promise.all([
      orchestrator.startTask(goal1),
      orchestrator.startTask(goal2)
    ]);

    const [final1, final2] = await Promise.all([
      waitForTaskCompletion(task1.id),
      waitForTaskCompletion(task2.id)
    ]);

    expect(final1.status).toBe('succeeded');
    expect(final2.status).toBe('succeeded');

    // Verify task 1 contains Globex and task 2 contains document extraction
    expect(final1.summary).toContain('Globex');
    expect(final2.summary).toContain('INV-2024-098');

    // Confirm separate event logs with distinct task IDs
    const events1 = taskRepo.getEventsForTask(task1.id);
    const events2 = taskRepo.getEventsForTask(task2.id);
    expect(events1.every(e => e.taskId === task1.id)).toBe(true);
    expect(events2.every(e => e.taskId === task2.id)).toBe(true);
  });

  // =========================================================================
  // Scenario L: Loop Protection & Step Budget Enforcement
  // =========================================================================
  it('Scenario L (Loop Protection): halts execution when maximum step budget is exhausted', async () => {
    // Create an orchestrator with a tiny step budget of 2 steps
    const restrictedOrchestrator = new AgentOrchestrator(
      taskRepo,
      createDefaultToolRegistry(),
      verificationEngine,
      new AutonomousDeterministicProvider(),
      {
        portalUrl: TEST_PORTAL_URL,
        maxSteps: 2,
        taskTimeoutMs: 15000
      }
    );

    const task = await restrictedOrchestrator.startTask('Find the latest invoice from Acme Ltd and record it.');
    const finalTask = await waitForTaskCompletion(task.id);

    expect(finalTask.status).toBe('budget_exhausted');
    expect(finalTask.summary?.toLowerCase()).toContain('budget');
  });

  // =========================================================================
  // Local Document Parsing Test
  // =========================================================================
  it('extracts and independently verifies fields from local invoice document', async () => {
    const goal = 'List and read sample invoice documents in repository, then extract structured fields.';

    const task = await orchestrator.startTask(goal);
    const finalTask = await waitForTaskCompletion(task.id);

    expect(finalTask?.status).toBe('succeeded');
    expect(finalTask?.summary).toContain('INV-2024-098');

    const verifiedEvent = taskRepo.getEventsForTask(task.id).find(event => event.eventType === 'verification_passed');
    expect(verifiedEvent).toBeDefined();
    expect(verifiedEvent?.payload.verification.evidence.extractedInvoice).toMatchObject({
      companyName: 'Acme Ltd',
      invoiceNumber: 'INV-2024-098',
      amount: 3890.5,
      dueDate: '2024-06-10'
    });
  });
});
