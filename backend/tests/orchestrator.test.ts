import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Server } from 'node:http';
import { createPortalApp } from '../../simulated-company/src/server.js';
import { PortalDatabase } from '../../simulated-company/src/database.js';
import { TaskRepository } from '../src/database/repository.js';
import { createDefaultToolRegistry } from '../src/tools/index.js';
import { VerificationEngine } from '../src/verification/engine.js';
import { AutonomousDeterministicProvider } from '../src/llm/autonomousDeterministicProvider.js';
import { AgentOrchestrator } from '../src/agent/orchestrator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_PORTAL_DB = path.resolve(__dirname, '../../data/test_orchestrator_portal.sqlite');
const TEST_TASK_DB = path.resolve(__dirname, '../../data/test_orchestrator_tasks.sqlite');
const TEST_PORTAL_PORT = 4099;
const TEST_PORTAL_URL = `http://localhost:${TEST_PORTAL_PORT}`;

describe('Autonomous Agent Orchestration & Execution Loop', () => {
  let portalServer: Server;
  let portalDb: PortalDatabase;
  let taskRepo: TaskRepository;
  let orchestrator: AgentOrchestrator;

  beforeAll(async () => {
    // Clean test databases
    if (fs.existsSync(TEST_PORTAL_DB)) fs.unlinkSync(TEST_PORTAL_DB);
    if (fs.existsSync(TEST_TASK_DB)) fs.unlinkSync(TEST_TASK_DB);

    portalDb = new PortalDatabase(TEST_PORTAL_DB);
    const { app } = createPortalApp(portalDb);

    await new Promise<void>((resolve) => {
      portalServer = app.listen(TEST_PORTAL_PORT, () => resolve());
    });

    taskRepo = new TaskRepository(TEST_TASK_DB);
    const tools = createDefaultToolRegistry();
    const verificationEngine = new VerificationEngine(TEST_PORTAL_URL);
    const llm = new AutonomousDeterministicProvider();

    orchestrator = new AgentOrchestrator(taskRepo, tools, verificationEngine, llm, {
      portalUrl: TEST_PORTAL_URL,
      requireApprovalForWrites: false,
      maxSteps: 15,
      taskTimeoutMs: 30000
    });
  });

  afterAll(async () => {
    portalDb.db.close();
    taskRepo.db.close();
    await new Promise<void>((resolve) => portalServer.close(() => resolve()));

    if (fs.existsSync(TEST_PORTAL_DB)) fs.unlinkSync(TEST_PORTAL_DB);
    if (fs.existsSync(TEST_TASK_DB)) fs.unlinkSync(TEST_TASK_DB);
  });

  it('successfully executes primary Acme Ltd invoice processing workflow with independent verification', async () => {
    const goal = 'Find the latest invoice from Acme Ltd, extract its amount and due date, enter it into the internal invoice system, verify the saved record, and report the outcome.';

    const task = await orchestrator.startTask(goal);
    expect(task.id).toBeDefined();

    // Poll until completed
    let finalTask = taskRepo.getTaskById(task.id);
    const startTime = Date.now();
    while (finalTask && !['succeeded', 'failed', 'budget_exhausted'].includes(finalTask.status)) {
      if (Date.now() - startTime > 15000) break;
      await new Promise(r => setTimeout(r, 200));
      finalTask = taskRepo.getTaskById(task.id);
    }

    expect(finalTask?.status).toBe('succeeded');
    expect(finalTask?.stepsCount).toBeGreaterThan(0);
    expect(finalTask?.summary).toContain('INV-2024-098');
    expect(finalTask?.summary).toContain('3890.5');

    // Confirm execution events were recorded
    const events = taskRepo.getEventsForTask(task.id);
    expect(events.length).toBeGreaterThan(0);
    const eventTypes = events.map(e => e.eventType);
    expect(eventTypes).toContain('task_started');
    expect(eventTypes).toContain('tool_call_completed');
    expect(eventTypes).toContain('verification_passed');
    expect(eventTypes).toContain('task_completed');

    // Verify record in portal DB
    const savedRecord = portalDb.getInvoiceRecordByNumber('INV-2024-098');
    expect(savedRecord).not.toBeNull();
    expect(savedRecord?.amount).toBe(3890.50);
    expect(savedRecord?.dueDate).toBe('2024-06-10');
  });

  it('detects pre-existing duplicate invoice and safely stops before corrupting ledger (Umbrella Inc)', async () => {
    const goal = 'Process invoice for Umbrella Inc and record in system.';

    const task = await orchestrator.startTask(goal);
    let finalTask = taskRepo.getTaskById(task.id);
    const startTime = Date.now();
    while (finalTask && !['succeeded', 'failed', 'budget_exhausted'].includes(finalTask.status)) {
      if (Date.now() - startTime > 15000) break;
      await new Promise(r => setTimeout(r, 200));
      finalTask = taskRepo.getTaskById(task.id);
    }

    expect(finalTask?.status).toBe('succeeded');
    expect(finalTask?.summary?.toLowerCase()).toContain('duplicate');

    const events = taskRepo.getEventsForTask(task.id);
    const verifiedEvent = events.find(e => e.eventType === 'verification_passed');
    expect(verifiedEvent).toBeDefined();
    expect(verifiedEvent?.payload.verification.evidence.duplicateDetected).toBe(true);
  });

  it('identifies missing due date on incomplete invoice and halts safely (Wayne Enterprises)', async () => {
    const goal = 'Process invoice for Wayne Enterprises.';

    const task = await orchestrator.startTask(goal);
    let finalTask = taskRepo.getTaskById(task.id);
    const startTime = Date.now();
    while (finalTask && !['succeeded', 'failed', 'budget_exhausted'].includes(finalTask.status)) {
      if (Date.now() - startTime > 15000) break;
      await new Promise(r => setTimeout(r, 200));
      finalTask = taskRepo.getTaskById(task.id);
    }

    expect(finalTask?.status).toBe('succeeded');
    expect(finalTask?.summary?.toLowerCase()).toContain('missing');

    const events = taskRepo.getEventsForTask(task.id);
    const verifiedEvent = events.find(e => e.eventType === 'verification_passed');
    expect(verifiedEvent).toBeDefined();
    expect(verifiedEvent?.payload.verification.evidence.missingFields).toContain('dueDate');
  });

  it('supports human clarification flow when goal is ambiguous (Nova Dynamics)', async () => {
    const goal = 'Process invoice for Nova Dynamics.';

    const task = await orchestrator.startTask(goal);

    // Wait until task reaches awaiting_clarification status
    let curTask = taskRepo.getTaskById(task.id);
    const startTime = Date.now();
    while (curTask && curTask.status !== 'awaiting_clarification') {
      if (Date.now() - startTime > 10000) break;
      await new Promise(r => setTimeout(r, 100));
      curTask = taskRepo.getTaskById(task.id);
    }

    expect(curTask?.status).toBe('awaiting_clarification');
    expect(curTask?.pendingClarification?.question).toContain('Nova Dynamics');

    // Provide clarification
    const resolved = await orchestrator.resolveClarification(task.id, 'Nova Dynamics Ltd (Regional)');
    expect(resolved).toBe(true);

    // Wait for subsequent steps
    let finalTask = taskRepo.getTaskById(task.id);
    const resumeTime = Date.now();
    while (finalTask && !['succeeded', 'failed', 'budget_exhausted'].includes(finalTask.status)) {
      if (Date.now() - resumeTime > 15000) break;
      await new Promise(r => setTimeout(r, 200));
      finalTask = taskRepo.getTaskById(task.id);
    }

    const events = taskRepo.getEventsForTask(task.id);
    const clarEvent = events.find(e => e.eventType === 'clarification_provided');
    expect(clarEvent).toBeDefined();
    expect(clarEvent?.payload.response).toBe('Nova Dynamics Ltd (Regional)');
  });
});
