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

export interface ExecutionEvent {
  id: string;
  taskId: string;
  stepNumber: number;
  timestamp: string;
  eventType: string;
  payload: Record<string, any>;
  durationMs?: number;
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

export interface DashboardStats {
  totalTasks: number;
  verified: number;
  failed: number;
  pendingApproval: number;
  pendingClarification: number;
}
