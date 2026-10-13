import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { TaskRecord, ExecutionEvent, TaskStatus } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class TaskRepository {
  public db: Database.Database;

  constructor(dbPath?: string) {
    const resolvedPath = dbPath || process.env.DATABASE_PATH || path.resolve(__dirname, '../../../data/taskpilot.sqlite');
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(resolvedPath);
    this.db.pragma('journal_mode = WAL');
    this.initSchema();
  }

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        goal TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT,
        plan_json TEXT,
        current_subgoal TEXT,
        steps_count INTEGER NOT NULL DEFAULT 0,
        max_steps INTEGER NOT NULL DEFAULT 15,
        retry_count INTEGER NOT NULL DEFAULT 0,
        evidence_json TEXT,
        error TEXT,
        summary TEXT,
        pending_approval_json TEXT,
        pending_clarification_json TEXT
      );

      CREATE TABLE IF NOT EXISTS execution_events (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        step_number INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        event_type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        duration_ms REAL,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_events_task_id ON execution_events(task_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    `);
  }

  public createTask(task: TaskRecord): TaskRecord {
    const stmt = this.db.prepare(`
      INSERT INTO tasks (
        id, goal, status, created_at, updated_at, completed_at,
        plan_json, current_subgoal, steps_count, max_steps, retry_count,
        evidence_json, error, summary, pending_approval_json, pending_clarification_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      task.id,
      task.goal,
      task.status,
      task.createdAt,
      task.updatedAt,
      task.completedAt || null,
      task.plan ? JSON.stringify(task.plan) : null,
      task.currentSubgoal || null,
      task.stepsCount,
      task.maxSteps,
      task.retryCount,
      task.evidence ? JSON.stringify(task.evidence) : null,
      task.error || null,
      task.summary || null,
      task.pendingApproval ? JSON.stringify(task.pendingApproval) : null,
      task.pendingClarification ? JSON.stringify(task.pendingClarification) : null
    );

    return task;
  }

  public updateTask(id: string, updates: Partial<TaskRecord>): TaskRecord | null {
    const existing = this.getTaskById(id);
    if (!existing) return null;

    const merged: TaskRecord = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    const stmt = this.db.prepare(`
      UPDATE tasks SET
        status = ?,
        updated_at = ?,
        completed_at = ?,
        plan_json = ?,
        current_subgoal = ?,
        steps_count = ?,
        max_steps = ?,
        retry_count = ?,
        evidence_json = ?,
        error = ?,
        summary = ?,
        pending_approval_json = ?,
        pending_clarification_json = ?
      WHERE id = ?
    `);

    stmt.run(
      merged.status,
      merged.updatedAt,
      merged.completedAt || null,
      merged.plan ? JSON.stringify(merged.plan) : null,
      merged.currentSubgoal || null,
      merged.stepsCount,
      merged.maxSteps,
      merged.retryCount,
      merged.evidence ? JSON.stringify(merged.evidence) : null,
      merged.error || null,
      merged.summary || null,
      merged.pendingApproval ? JSON.stringify(merged.pendingApproval) : null,
      merged.pendingClarification ? JSON.stringify(merged.pendingClarification) : null,
      id
    );

    return merged;
  }

  public getTaskById(id: string): TaskRecord | null {
    const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;
    if (!row) return null;

    return {
      id: row.id,
      goal: row.goal,
      status: row.status as TaskStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at || undefined,
      plan: row.plan_json ? JSON.parse(row.plan_json) : undefined,
      currentSubgoal: row.current_subgoal || undefined,
      stepsCount: row.steps_count,
      maxSteps: row.max_steps,
      retryCount: row.retry_count,
      evidence: row.evidence_json ? JSON.parse(row.evidence_json) : undefined,
      error: row.error || undefined,
      summary: row.summary || undefined,
      pendingApproval: row.pending_approval_json ? JSON.parse(row.pending_approval_json) : undefined,
      pendingClarification: row.pending_clarification_json ? JSON.parse(row.pending_clarification_json) : undefined
    };
  }

  public listTasks(status?: TaskStatus, limit = 50): TaskRecord[] {
    let query = 'SELECT * FROM tasks';
    const params: any[] = [];
    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }
    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map(row => ({
      id: row.id,
      goal: row.goal,
      status: row.status as TaskStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at || undefined,
      plan: row.plan_json ? JSON.parse(row.plan_json) : undefined,
      currentSubgoal: row.current_subgoal || undefined,
      stepsCount: row.steps_count,
      maxSteps: row.max_steps,
      retryCount: row.retry_count,
      evidence: row.evidence_json ? JSON.parse(row.evidence_json) : undefined,
      error: row.error || undefined,
      summary: row.summary || undefined,
      pendingApproval: row.pending_approval_json ? JSON.parse(row.pending_approval_json) : undefined,
      pendingClarification: row.pending_clarification_json ? JSON.parse(row.pending_clarification_json) : undefined
    }));
  }

  public recordEvent(event: ExecutionEvent): ExecutionEvent {
    const stmt = this.db.prepare(`
      INSERT INTO execution_events (
        id, task_id, step_number, timestamp, event_type, payload_json, duration_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      event.id,
      event.taskId,
      event.stepNumber,
      event.timestamp,
      event.eventType,
      JSON.stringify(event.payload),
      event.durationMs || null
    );

    return event;
  }

  public getEventsForTask(taskId: string): ExecutionEvent[] {
    const rows = this.db.prepare(`
      SELECT * FROM execution_events WHERE task_id = ? ORDER BY step_number ASC, timestamp ASC
    `).all(taskId) as any[];

    return rows.map(r => ({
      id: r.id,
      taskId: r.task_id,
      stepNumber: r.step_number,
      timestamp: r.timestamp,
      eventType: r.event_type,
      payload: JSON.parse(r.payload_json),
      durationMs: r.duration_ms || undefined
    }));
  }

  public getDashboardStats() {
    const totalTasks = (this.db.prepare('SELECT COUNT(*) as cnt FROM tasks').get() as any).cnt;
    const verified = (this.db.prepare("SELECT COUNT(*) as cnt FROM tasks WHERE status = 'succeeded'").get() as any).cnt;
    const failed = (this.db.prepare("SELECT COUNT(*) as cnt FROM tasks WHERE status IN ('failed', 'budget_exhausted')").get() as any).cnt;
    const pendingApproval = (this.db.prepare("SELECT COUNT(*) as cnt FROM tasks WHERE status = 'awaiting_approval'").get() as any).cnt;
    const pendingClarification = (this.db.prepare("SELECT COUNT(*) as cnt FROM tasks WHERE status = 'awaiting_clarification'").get() as any).cnt;

    return {
      totalTasks,
      verified,
      failed,
      pendingApproval,
      pendingClarification
    };
  }

  public clearAllTasks(): void {
    this.db.exec('DELETE FROM execution_events; DELETE FROM tasks;');
  }
}
