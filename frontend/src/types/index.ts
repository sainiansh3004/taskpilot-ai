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

export type VerificationStatus = 'verified_success' | 'verified_failure' | 'inconclusive';

export interface VerificationResult {
  verified: boolean;
  status: VerificationStatus;
  score: number;
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

export interface DashboardStats {
  totalTasks: number;
  verified: number;
  failed: number;
  pendingApproval: number;
  pendingClarification: number;
  statePersistence?: 'shared' | 'instance-local';
}
