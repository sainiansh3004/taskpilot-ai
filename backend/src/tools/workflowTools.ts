import { z } from 'zod';
import type { ToolDefinition } from '../types/index.js';

export const requestApprovalTool: ToolDefinition = {
  name: 'request_approval',
  description: 'Pause execution and request explicit human approval before executing a high-stakes, irreversible, or consequential action.',
  sideEffect: 'read_only',
  timeoutMs: 60000,
  inputSchema: z.object({
    actionName: z.string().describe('The name of the action/tool to be approved'),
    details: z.record(z.any()).describe('The parameters and target data of the proposed action'),
    reason: z.string().describe('Explanation of why approval is required')
  }),
  execute: async ({ actionName, details, reason }, context) => {
    const approved = await context.requestApproval(actionName, details, reason);
    return {
      approved,
      status: approved ? 'AUTHORIZED' : 'REJECTED',
      message: approved ? 'Operator granted approval to proceed.' : 'Operator rejected the proposed action.'
    };
  }
};

export const requestClarificationTool: ToolDefinition = {
  name: 'request_clarification',
  description: 'Pause execution and ask the human operator for clarification when the task objective is ambiguous, multiple conflicting targets exist, or essential information is missing.',
  sideEffect: 'read_only',
  timeoutMs: 60000,
  inputSchema: z.object({
    question: z.string().describe('The clarification question for the human operator'),
    options: z.array(z.string()).optional().describe('Optional list of suggested choices for the operator'),
    context: z.record(z.any()).optional().describe('Contextual information about the ambiguity')
  }),
  execute: async ({ question, options, context: promptContext }, context) => {
    const answer = await context.requestClarification(question, options, promptContext);
    return {
      clarificationProvided: true,
      operatorResponse: answer
    };
  }
};

export const inspectTaskStateTool: ToolDefinition = {
  name: 'inspect_task_state',
  description: 'Inspect the current task execution state, agent working memory, and verified evidence accumulated so far.',
  sideEffect: 'read_only',
  timeoutMs: 3000,
  inputSchema: z.object({}),
  execute: async (_input, context) => {
    return {
      taskId: context.taskId,
      stepNumber: context.stepNumber,
      memory: context.memory
    };
  }
};
