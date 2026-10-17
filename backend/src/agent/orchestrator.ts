import { v4 as uuidv4 } from 'uuid';
import type {
  TaskRecord,
  ExecutionEvent,
  AgentContext,
  TaskStatus,
  PendingApproval,
  PendingClarification
} from '../types/index.js';
import { TaskRepository } from '../database/repository.js';
import { ToolRegistry } from '../tools/registry.js';
import { VerificationEngine } from '../verification/engine.js';
import type { LLMProvider, LLMMessage } from '../llm/types.js';

export interface OrchestratorConfig {
  maxSteps?: number;
  maxRetriesPerAction?: number;
  actionTimeoutMs?: number;
  taskTimeoutMs?: number;
  requireApprovalForWrites?: boolean;
  portalUrl?: string;
}

export type EventCallback = (event: ExecutionEvent) => void;

export class AgentOrchestrator {
  private repo: TaskRepository;
  private tools: ToolRegistry;
  private verificationEngine: VerificationEngine;
  private llm: LLMProvider;
  private config: Required<OrchestratorConfig>;
  private eventListeners: Map<string, Set<EventCallback>> = new Map();
  private approvalResolvers: Map<string, (approved: boolean) => void> = new Map();
  private clarificationResolvers: Map<string, (response: string) => void> = new Map();
  private activeExecutions: Set<string> = new Set();

  constructor(
    repo: TaskRepository,
    tools: ToolRegistry,
    verificationEngine: VerificationEngine,
    llm: LLMProvider,
    config: OrchestratorConfig = {}
  ) {
    this.repo = repo;
    this.tools = tools;
    this.verificationEngine = verificationEngine;
    this.llm = llm;
    this.config = {
      maxSteps: config.maxSteps || parseInt(process.env.MAX_STEPS || '15', 10),
      maxRetriesPerAction: config.maxRetriesPerAction || parseInt(process.env.MAX_RETRIES_PER_ACTION || '3', 10),
      actionTimeoutMs: config.actionTimeoutMs || parseInt(process.env.ACTION_TIMEOUT_MS || '15000', 10),
      taskTimeoutMs: config.taskTimeoutMs || parseInt(process.env.TASK_TOTAL_TIMEOUT_MS || '120000', 10),
      requireApprovalForWrites: config.requireApprovalForWrites !== undefined
        ? config.requireApprovalForWrites
        : process.env.REQUIRE_APPROVAL_FOR_WRITES === 'true',
      portalUrl: config.portalUrl || process.env.SIMULATED_PORTAL_URL || 'http://localhost:4001'
    };
  }

  public subscribe(taskId: string, callback: EventCallback): () => void {
    if (!this.eventListeners.has(taskId)) {
      this.eventListeners.set(taskId, new Set());
    }
    this.eventListeners.get(taskId)!.add(callback);
    return () => {
      this.eventListeners.get(taskId)?.delete(callback);
    };
  }

  private emitEvent(event: ExecutionEvent) {
    this.repo.recordEvent(event);
    const listeners = this.eventListeners.get(event.taskId);
    if (listeners) {
      listeners.forEach(cb => {
        try { cb(event); } catch (e) { console.error('Listener callback error:', e); }
      });
    }
  }

  public async startTask(goal: string): Promise<TaskRecord> {
    if (!goal || goal.trim().length === 0) {
      throw new Error('Goal cannot be empty.');
    }

    const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const task: TaskRecord = {
      id: taskId,
      goal: goal.trim(),
      status: 'queued',
      createdAt: now,
      updatedAt: now,
      stepsCount: 0,
      maxSteps: this.config.maxSteps,
      retryCount: 0
    };

    this.repo.createTask(task);

    // Launch execution loop asynchronously
    this.runExecutionLoop(taskId).catch(err => {
      console.error(`Task ${taskId} encountered fatal execution error:`, err);
    });

    return task;
  }

  public async resolveApproval(taskId: string, approved: boolean): Promise<boolean> {
    const task = this.repo.getTaskById(taskId);
    if (!task || !task.pendingApproval || task.status !== 'awaiting_approval' || !this.activeExecutions.has(taskId)) {
      return false;
    }

    const approval = task.pendingApproval;
    approval.status = approved ? 'approved' : 'rejected';
    approval.resolvedAt = new Date().toISOString();

    this.repo.updateTask(taskId, {
      status: 'running',
      pendingApproval: approval
    });

    this.emitEvent({
      id: uuidv4(),
      taskId,
      stepNumber: task.stepsCount,
      timestamp: new Date().toISOString(),
      eventType: 'approval_resolved',
      payload: { approvalId: approval.id, approved, actionName: approval.toolName }
    });

    const resolver = this.approvalResolvers.get(approval.id);
    if (resolver) {
      resolver(approved);
      this.approvalResolvers.delete(approval.id);
    }

    return true;
  }

  public async resolveClarification(taskId: string, response: string): Promise<boolean> {
    const task = this.repo.getTaskById(taskId);
    if (!task || !task.pendingClarification || task.status !== 'awaiting_clarification' || !this.activeExecutions.has(taskId)) {
      return false;
    }

    const clarification = task.pendingClarification;
    clarification.response = response;
    clarification.resolvedAt = new Date().toISOString();

    this.repo.updateTask(taskId, {
      status: 'running',
      pendingClarification: clarification
    });

    this.emitEvent({
      id: uuidv4(),
      taskId,
      stepNumber: task.stepsCount,
      timestamp: new Date().toISOString(),
      eventType: 'clarification_provided',
      payload: { clarificationId: clarification.id, response }
    });

    const resolver = this.clarificationResolvers.get(clarification.id);
    if (resolver) {
      resolver(response);
      this.clarificationResolvers.delete(clarification.id);
    }

    return true;
  }

  public cancelTask(taskId: string): boolean {
    const task = this.repo.getTaskById(taskId);
    if (!task || ['succeeded', 'failed', 'cancelled', 'budget_exhausted'].includes(task.status)) {
      return false;
    }

    this.activeExecutions.delete(taskId);

    // Unblock any pending approval or clarification promises immediately
    if (task.pendingApproval) {
      const resolver = this.approvalResolvers.get(task.pendingApproval.id);
      if (resolver) {
        resolver(false);
        this.approvalResolvers.delete(task.pendingApproval.id);
      }
    }
    if (task.pendingClarification) {
      const resolver = this.clarificationResolvers.get(task.pendingClarification.id);
      if (resolver) {
        resolver('CANCELLED');
        this.clarificationResolvers.delete(task.pendingClarification.id);
      }
    }

    this.repo.updateTask(taskId, {
      status: 'cancelled',
      completedAt: new Date().toISOString(),
      summary: 'Task was cancelled by operator.'
    });

    this.emitEvent({
      id: uuidv4(),
      taskId,
      stepNumber: task.stepsCount,
      timestamp: new Date().toISOString(),
      eventType: 'task_completed',
      payload: { status: 'cancelled', reason: 'Operator cancellation' }
    });

    return true;
  }

  private async runExecutionLoop(taskId: string) {
    if (this.activeExecutions.has(taskId)) return;
    this.activeExecutions.add(taskId);

    const startTime = Date.now();
    let task = this.repo.getTaskById(taskId);
    if (!task) return;

    this.repo.updateTask(taskId, { status: 'running' });
    this.emitEvent({
      id: uuidv4(),
      taskId,
      stepNumber: 0,
      timestamp: new Date().toISOString(),
      eventType: 'task_started',
      payload: { goal: task.goal, maxSteps: this.config.maxSteps }
    });

    const memory: Record<string, any> = {};
    const history: LLMMessage[] = [
      { role: 'user', content: task.goal }
    ];

    // Loop detection trackers
    const callSignatures: string[] = [];
    let consecutiveSameActionCount = 0;
    let consecutiveActionRetries = 0;

    const openAISchemas = this.tools.getOpenAIToolSchemas();
    const availableToolSchemas = this.tools.getAll().map((t, idx) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
      openAISchema: openAISchemas[idx]
    }));

    try {
      while (this.activeExecutions.has(taskId)) {
        // 1. Enforce Budget & Timeout Constraints
        if (task.stepsCount >= this.config.maxSteps) {
          await this.finishTask(taskId, 'budget_exhausted', 'Maximum allowed step budget exceeded without verified completion.', memory);
          break;
        }

        if (Date.now() - startTime > this.config.taskTimeoutMs) {
          await this.finishTask(taskId, 'failed', `Task exceeded total timeout limit of ${this.config.taskTimeoutMs}ms.`, memory);
          break;
        }

        task.stepsCount += 1;
        this.repo.updateTask(taskId, { stepsCount: task.stepsCount });

        // 2. Query LLM Provider for Next Decision
        const decision = await this.llm.generateNextAction(task.goal, history, availableToolSchemas, memory);

        // Update plan and subgoals if provided
        if (decision.plan && (!task.plan || task.plan.length === 0)) {
          task.plan = decision.plan;
          this.repo.updateTask(taskId, { plan: decision.plan });
          this.emitEvent({
            id: uuidv4(),
            taskId,
            stepNumber: task.stepsCount,
            timestamp: new Date().toISOString(),
            eventType: 'plan_created',
            payload: { plan: decision.plan }
          });
        }

        if (decision.subgoal) {
          task.currentSubgoal = decision.subgoal;
          this.repo.updateTask(taskId, { currentSubgoal: decision.subgoal });
          this.emitEvent({
            id: uuidv4(),
            taskId,
            stepNumber: task.stepsCount,
            timestamp: new Date().toISOString(),
            eventType: 'subgoal_set',
            payload: { subgoal: decision.subgoal, thought: decision.thought }
          });
        }

        // 3. Check if LLM decided it has finished
        if (decision.isFinished) {
          // Perform Independent Postcondition Verification
          this.emitEvent({
            id: uuidv4(),
            taskId,
            stepNumber: task.stepsCount,
            timestamp: new Date().toISOString(),
            eventType: 'verification_started',
            payload: { reason: 'Agent requested completion, starting independent postcondition verification' }
          });

          const verification = await this.verificationEngine.verifyTaskCompletion(task.goal, memory);

          if (memory.approvalRejected) {
            this.emitEvent({
              id: uuidv4(),
              taskId,
              stepNumber: task.stepsCount,
              timestamp: new Date().toISOString(),
              eventType: verification.verified ? 'verification_passed' : 'verification_failed',
              payload: { verification }
            });

            await this.finishTask(taskId, 'failed', decision.finalAnswer || 'Task halted: Operator rejected authorization.', memory, verification.evidence);
          } else if (verification.verified) {
            this.emitEvent({
              id: uuidv4(),
              taskId,
              stepNumber: task.stepsCount,
              timestamp: new Date().toISOString(),
              eventType: 'verification_passed',
              payload: { verification }
            });

            await this.finishTask(taskId, 'succeeded', decision.finalAnswer || verification.summary, memory, verification.evidence);
          } else {
            this.emitEvent({
              id: uuidv4(),
              taskId,
              stepNumber: task.stepsCount,
              timestamp: new Date().toISOString(),
              eventType: 'verification_failed',
              payload: { verification }
            });

            // If some conditions passed, set to partially_succeeded; otherwise failed
            const finalStatus = verification.score > 0 ? 'partially_succeeded' : 'failed';
            await this.finishTask(taskId, finalStatus, `Verification did not pass all postconditions: ${verification.summary}`, memory, verification.evidence);
          }
          break;
        }

        // 4. Validate Tool Call Existence
        if (!decision.toolCall) {
          await this.finishTask(taskId, 'failed', 'Agent failed to produce a valid tool call or completion signal.', memory);
          break;
        }

        const { name: toolName, arguments: toolArgs, id: toolCallId } = decision.toolCall;
        const callSig = `${toolName}:${JSON.stringify(toolArgs)}`;

        // 5. Loop & Repeat Action Detection
        if (callSignatures.length > 0 && callSignatures[callSignatures.length - 1] === callSig) {
          consecutiveSameActionCount += 1;
        } else {
          consecutiveSameActionCount = 1;
        }
        callSignatures.push(callSig);

        const isConsecutiveRepeat = consecutiveSameActionCount >= 3;
        const isOscillating = callSignatures.length >= 6 &&
          callSignatures[callSignatures.length - 1] === callSignatures[callSignatures.length - 3] &&
          callSignatures[callSignatures.length - 3] === callSignatures[callSignatures.length - 5] &&
          callSignatures[callSignatures.length - 2] === callSignatures[callSignatures.length - 4] &&
          callSignatures[callSignatures.length - 4] === callSignatures[callSignatures.length - 6];

        if (isConsecutiveRepeat || isOscillating) {
          this.emitEvent({
            id: uuidv4(),
            taskId,
            stepNumber: task.stepsCount,
            timestamp: new Date().toISOString(),
            eventType: 'loop_detected',
            payload: {
              toolName,
              toolArgs,
              repeatCount: consecutiveSameActionCount,
              pattern: isOscillating ? 'oscillating_cycle' : 'consecutive_repeat'
            }
          });

          await this.finishTask(
            taskId,
            'failed',
            `Loop detected: Agent repeated ${isOscillating ? 'an oscillating action cycle' : `identical action '${toolName}' ${consecutiveSameActionCount} times`} without productive progress. Halting loop.`,
            memory
          );
          break;
        }

        // 6. Build Execution Context with Callbacks
        const context: AgentContext = {
          taskId,
          stepNumber: task.stepsCount,
          memory,
          portalUrl: this.config.portalUrl,
          requireApprovalForWrites: this.config.requireApprovalForWrites,
          emitEvent: (type, payload, durationMs) => {
            this.emitEvent({
              id: uuidv4(),
              taskId,
              stepNumber: task.stepsCount,
              timestamp: new Date().toISOString(),
              eventType: type,
              payload,
              durationMs
            });
          },
          requestApproval: async (tName, args, reason) => {
            const approvalId = `appr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
            const pending: PendingApproval = {
              id: approvalId,
              toolName: tName,
              toolArguments: args,
              reason,
              requestedAt: new Date().toISOString(),
              status: 'pending'
            };

            this.repo.updateTask(taskId, {
              status: 'awaiting_approval',
              pendingApproval: pending
            });

            this.emitEvent({
              id: uuidv4(),
              taskId,
              stepNumber: task.stepsCount,
              timestamp: new Date().toISOString(),
              eventType: 'approval_requested',
              payload: pending
            });

            return new Promise<boolean>(resolve => {
              this.approvalResolvers.set(approvalId, resolve);
            });
          },
          requestClarification: async (question, options, promptContext) => {
            const clarId = `clar_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
            const pending: PendingClarification = {
              id: clarId,
              question,
              options,
              context: promptContext || {},
              requestedAt: new Date().toISOString()
            };

            this.repo.updateTask(taskId, {
              status: 'awaiting_clarification',
              pendingClarification: pending
            });

            this.emitEvent({
              id: uuidv4(),
              taskId,
              stepNumber: task.stepsCount,
              timestamp: new Date().toISOString(),
              eventType: 'clarification_requested',
              payload: pending
            });

            return new Promise<string>(resolve => {
              this.clarificationResolvers.set(clarId, resolve);
            });
          }
        };

        // 7. Execute Tool with Retries
        if (!this.activeExecutions.has(taskId)) break;

        this.emitEvent({
          id: uuidv4(),
          taskId,
          stepNumber: task.stepsCount,
          timestamp: new Date().toISOString(),
          eventType: 'tool_call_started',
          payload: { toolName, toolArgs, thought: decision.thought }
        });

        let toolResult = await this.tools.executeTool(toolName, toolArgs, context);

        if (!this.activeExecutions.has(taskId)) break;

        // Bounded retries with backoff for transient failures (per-action tracker)
        let actionRetryCount = 0;
        const isTransientError = (err?: string) => {
          if (!err) return false;
          const e = err.toLowerCase();
          return (
            e.includes('500') ||
            e.includes('502') ||
            e.includes('503') ||
            e.includes('504') ||
            e.includes('timeout') ||
            e.includes('rate limit') ||
            e.includes('429') ||
            e.includes('econnreset') ||
            e.includes('etimedout')
          );
        };

        while (!toolResult.success && isTransientError(toolResult.error) && actionRetryCount < this.config.maxRetriesPerAction) {
          actionRetryCount += 1;
          task.retryCount += 1;
          this.repo.updateTask(taskId, { retryCount: task.retryCount });

          const backoffMs = Math.min(250 * Math.pow(2, actionRetryCount - 1), 2000);
          this.emitEvent({
            id: uuidv4(),
            taskId,
            stepNumber: task.stepsCount,
            timestamp: new Date().toISOString(),
            eventType: 'retry_attempted',
            payload: {
              toolName,
              attempt: actionRetryCount,
              maxRetries: this.config.maxRetriesPerAction,
              error: toolResult.error,
              backoffMs
            }
          });

          await new Promise(r => setTimeout(r, backoffMs));
          if (!this.activeExecutions.has(taskId)) break;
          toolResult = await this.tools.executeTool(toolName, toolArgs, context);
        }

        if (!this.activeExecutions.has(taskId)) break;

        // Special handling for human approval denial
        if (!toolResult.success && toolResult.error?.includes('APPROVAL_DENIED')) {
          memory.approvalRejected = true;
          this.emitEvent({
            id: uuidv4(),
            taskId,
            stepNumber: task.stepsCount,
            timestamp: new Date().toISOString(),
            eventType: 'tool_call_failed',
            payload: { toolName, error: toolResult.error },
            durationMs: toolResult.durationMs
          });

          // Run independent postcondition verification
          const verification = await this.verificationEngine.verifyTaskCompletion(task.goal, memory);
          this.emitEvent({
            id: uuidv4(),
            taskId,
            stepNumber: task.stepsCount,
            timestamp: new Date().toISOString(),
            eventType: verification.verified ? 'verification_passed' : 'verification_failed',
            payload: { verification }
          });

          await this.finishTask(
            taskId,
            'failed',
            `Operation aborted: Consequential action '${toolName}' was denied/rejected by human operator during authorization confirmation. Protected action was NOT executed.`,
            memory,
            verification.evidence
          );
          break;
        }

        // Special handling for duplicate record rejection at database layer
        if (!toolResult.success && toolResult.error?.includes('DUPLICATE_RECORD')) {
          memory.duplicateDetected = true;
          this.emitEvent({
            id: uuidv4(),
            taskId,
            stepNumber: task.stepsCount,
            timestamp: new Date().toISOString(),
            eventType: 'tool_call_failed',
            payload: { toolName, error: toolResult.error },
            durationMs: toolResult.durationMs
          });

          const verification = await this.verificationEngine.verifyTaskCompletion(task.goal, memory);
          await this.finishTask(
            taskId,
            'succeeded',
            `Safe duplicate interception: Invoice is already recorded in the system ledger. Write was safely prevented to protect financial integrity.`,
            memory,
            verification.evidence
          );
          break;
        }

        if (toolResult.success) {
          if (toolName === 'search_invoices') {
            memory.searchInvoicesResult = {
              invoked: true,
              success: true,
              count: toolResult.data?.count,
              invoices: toolResult.data?.invoices,
              query: toolArgs?.query
            };
          }
          if (toolName === 'extract_supported_invoice_fields') {
            memory.extractedInvoice = toolResult.data?.extracted;
          }
          if (toolName === 'create_invoice_record' && toolResult.data?.record) {
            memory.createdRecord = toolResult.data.record;
          }
          if (toolName === 'read_invoice' && toolResult.data) {
            memory.selectedInvoice = toolResult.data;
            memory.invoiceNumber = toolResult.data.invoiceNumber;
            memory.companyName = toolResult.data.companyName;
          }

          this.emitEvent({
            id: uuidv4(),
            taskId,
            stepNumber: task.stepsCount,
            timestamp: new Date().toISOString(),
            eventType: 'tool_call_completed',
            payload: { toolName, data: toolResult.data },
            durationMs: toolResult.durationMs
          });

          // Append to history
          history.push({
            role: 'assistant',
            content: decision.thought,
            tool_calls: [{
              id: toolCallId,
              type: 'function',
              function: { name: toolName, arguments: JSON.stringify(toolArgs) }
            }]
          });

          history.push({
            role: 'tool',
            tool_call_id: toolCallId,
            name: toolName,
            content: JSON.stringify(toolResult.data)
          });
        } else {
          if (toolName === 'search_invoices') {
            memory.searchInvoicesResult = {
              invoked: true,
              success: false,
              error: toolResult.error,
              query: toolArgs?.query
            };
          }

          this.emitEvent({
            id: uuidv4(),
            taskId,
            stepNumber: task.stepsCount,
            timestamp: new Date().toISOString(),
            eventType: 'tool_call_failed',
            payload: { toolName, error: toolResult.error },
            durationMs: toolResult.durationMs
          });

          history.push({
            role: 'assistant',
            content: decision.thought,
            tool_calls: [{
              id: toolCallId,
              type: 'function',
              function: { name: toolName, arguments: JSON.stringify(toolArgs) }
            }]
          });

          history.push({
            role: 'tool',
            tool_call_id: toolCallId,
            name: toolName,
            content: JSON.stringify({ error: toolResult.error })
          });
        }
      }
    } catch (err: any) {
      console.error(`Orchestrator error for task ${taskId}:`, err);
      await this.finishTask(taskId, 'failed', `Execution loop terminated with error: ${err.message}`, memory);
    } finally {
      this.activeExecutions.delete(taskId);
    }
  }

  private async finishTask(
    taskId: string,
    status: TaskStatus,
    summary: string,
    memory: Record<string, any>,
    evidence?: Record<string, any>
  ) {
    this.activeExecutions.delete(taskId);
    const now = new Date().toISOString();

    const updated = this.repo.updateTask(taskId, {
      status,
      completedAt: now,
      summary,
      evidence: evidence || { finalMemory: memory },
      error: ['failed', 'budget_exhausted'].includes(status) ? summary : undefined
    });

    this.emitEvent({
      id: uuidv4(),
      taskId,
      stepNumber: updated?.stepsCount || 0,
      timestamp: now,
      eventType: 'task_completed',
      payload: { status, summary, evidence: updated?.evidence }
    });
  }
}
