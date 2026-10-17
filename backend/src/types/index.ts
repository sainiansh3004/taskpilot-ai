export type TaskStatus =
  | 'queued'
  | 'running'
  | 'awaiting_approval'
  | 'awaiting_clarification'
  | 'succeeded'
  | 'partially_succeeded'
  | 'failed'
  | 'cancelled'
  | 'budget_exhausted';

export type ToolSideEffect = 'read_only' | 'consequential_write';

export interface ExecutionEvent {
  id: string;
  taskId: string;
  stepNumber: number;
  timestamp: string;
  eventType: 
    | 'task_started'
    | 'plan_created'
    | 'subgoal_set'
    | 'tool_call_started'
    | 'tool_call_completed'
    | 'tool_call_failed'
    | 'retry_attempted'
    | 'approval_requested'
    | 'approval_resolved'
    | 'clarification_requested'
    | 'clarification_provided'
    | 'verification_started'
    | 'verification_passed'
    | 'verification_failed'
    | 'task_completed'
    | 'loop_detected'
    | 'budget_exceeded';
  payload: Record<string, any>;
  durationMs?: number;
}

export interface TaskRecord {
  id: string;
  goal: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  plan?: string[];
  currentSubgoal?: string;
  stepsCount: number;
  maxSteps: number;
  retryCount: number;
  evidence?: Record<string, any>;
  error?: string;
  summary?: string;
  pendingApproval?: PendingApproval;
  pendingClarification?: PendingClarification;
}

export interface PendingApproval {
  id: string;
  toolName: string;
  toolArguments: Record<string, any>;
  reason: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  resolvedAt?: string;
}

export interface PendingClarification {
  id: string;
  question: string;
  options?: string[];
  context: Record<string, any>;
  requestedAt: string;
  resolvedAt?: string;
  response?: string;
}

export interface ToolDefinition<TInput = any, TOutput = any> {
  name: string;
  description: string;
  sideEffect: ToolSideEffect;
  inputSchema: any; // Zod schema
  outputSchema?: any;
  timeoutMs: number;
  execute: (input: TInput, context: AgentContext) => Promise<TOutput>;
}

export interface AgentContext {
  taskId: string;
  stepNumber: number;
  memory: Record<string, any>;
  portalUrl: string;
  requireApprovalForWrites: boolean;
  emitEvent: (type: ExecutionEvent['eventType'], payload: Record<string, any>, durationMs?: number) => void;
  requestApproval: (toolName: string, args: Record<string, any>, reason: string) => Promise<boolean>;
  requestClarification: (question: string, options?: string[], context?: Record<string, any>) => Promise<string>;
}

export type VerificationStatus = 'verified_success' | 'verified_failure' | 'inconclusive';

export interface VerificationResult {
  verified: boolean;
  status: VerificationStatus;
  score: number; // 0 to 1
  checkedConditions: Array<{
    name: string;
    passed: boolean;
    expected: any;
    actual: any;
    details?: string;
  }>;
  evidence: Record<string, any>;
  summary: string;
}
