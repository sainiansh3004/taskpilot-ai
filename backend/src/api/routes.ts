import { Router } from 'express';
import { z } from 'zod';
import type { AgentOrchestrator } from '../agent/orchestrator.js';
import type { TaskRepository } from '../database/repository.js';
import type { ToolRegistry } from '../tools/registry.js';
import type { TaskStatus } from '../types/index.js';

export function createApiRouter(
  orchestrator: AgentOrchestrator,
  repo: TaskRepository,
  tools: ToolRegistry
): Router {
  const router = Router();

  const CreateTaskSchema = z.object({
    goal: z.string().min(1, 'Goal must not be empty').max(1000, 'Goal is too long')
  });

  // 1. Create a new autonomous task
  router.post('/tasks', async (req, res) => {
    try {
      const parsed = CreateTaskSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          details: parsed.error.issues
        });
      }

      const task = await orchestrator.startTask(parsed.data.goal);
      res.status(201).json({ success: true, task });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 2. List tasks (with optional status filter)
  router.get('/tasks', (req, res) => {
    try {
      const status = req.query.status as TaskStatus | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const tasks = repo.listTasks(status, limit);
      res.json({ success: true, count: tasks.length, tasks });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 2b. Reset all tasks
  router.delete('/tasks', (_req, res) => {
    try {
      repo.clearAllTasks();
      res.json({ success: true, message: 'All tasks and execution history cleared.' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 3. Get single task by ID
  router.get('/tasks/:id', (req, res) => {
    try {
      const task = repo.getTaskById(req.params.id);
      if (!task) {
        return res.status(404).json({ success: false, error: `Task '${req.params.id}' not found.` });
      }
      res.json({ success: true, task });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 4. Get execution events for a task
  router.get('/tasks/:id/events', (req, res) => {
    try {
      const events = repo.getEventsForTask(req.params.id);
      res.json({ success: true, count: events.length, events });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 5. SSE Real-time event streaming for a task
  router.get('/tasks/:id/stream', (req, res) => {
    const taskId = req.params.id;
    const task = repo.getTaskById(taskId);
    if (!task) {
      return res.status(404).json({ success: false, error: `Task '${taskId}' not found.` });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Send initial catch-up events
    const existingEvents = repo.getEventsForTask(taskId);
    for (const evt of existingEvents) {
      res.write(`data: ${JSON.stringify(evt)}\n\n`);
    }

    // Subscribe to ongoing events
    const unsubscribe = orchestrator.subscribe(taskId, (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });

    req.on('close', () => {
      unsubscribe();
      res.end();
    });
  });

  // 6. Resolve human approval gate (supports both /approve and /approval)
  const handleApproval = async (req: any, res: any) => {
    try {
      const { approved } = req.body;
      if (typeof approved !== 'boolean') {
        return res.status(400).json({ success: false, error: 'Field "approved" (boolean) is required.' });
      }

      const success = await orchestrator.resolveApproval(req.params.id, approved);
      if (!success) {
        return res.status(400).json({
          success: false,
          error: 'Task is not awaiting approval or has already been resolved.'
        });
      }

      const updated = repo.getTaskById(req.params.id);
      res.json({ success: true, task: updated });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  };

  router.post('/tasks/:id/approve', handleApproval);
  router.post('/tasks/:id/approval', handleApproval);

  // 7. Provide human clarification
  router.post('/tasks/:id/clarify', async (req, res) => {
    try {
      const { response } = req.body;
      if (typeof response !== 'string' || response.trim().length === 0) {
        return res.status(400).json({ success: false, error: 'Non-empty "response" string is required.' });
      }

      const success = await orchestrator.resolveClarification(req.params.id, response.trim());
      if (!success) {
        return res.status(400).json({
          success: false,
          error: 'Task is not awaiting clarification or has already been resolved.'
        });
      }

      const updated = repo.getTaskById(req.params.id);
      res.json({ success: true, task: updated });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 8. Cancel running task
  router.post('/tasks/:id/cancel', (req, res) => {
    try {
      const cancelled = orchestrator.cancelTask(req.params.id);
      if (!cancelled) {
        return res.status(400).json({ success: false, error: 'Task cannot be cancelled in its current state.' });
      }
      res.json({ success: true, message: `Task '${req.params.id}' cancelled successfully.` });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 9. Dashboard stats
  router.get('/stats', (_req, res) => {
    try {
      const stats = repo.getDashboardStats();
      res.json({ success: true, stats });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 10. List registered tools with schemas and side-effect ratings
  router.get('/tools', (_req, res) => {
    try {
      const toolList = tools.getAll().map(t => ({
        name: t.name,
        description: t.description,
        sideEffect: t.sideEffect,
        timeoutMs: t.timeoutMs,
        schema: t.inputSchema?.shape ? Object.keys(t.inputSchema.shape) : []
      }));
      res.json({ success: true, count: toolList.length, tools: toolList });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
