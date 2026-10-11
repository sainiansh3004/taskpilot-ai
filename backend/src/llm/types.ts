export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  name?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

export interface LLMDecision {
  thought: string;
  plan?: string[];
  subgoal?: string;
  toolCall?: {
    id: string;
    name: string;
    arguments: Record<string, any>;
  };
  isFinished?: boolean;
  finalAnswer?: string;
}

export interface LLMProvider {
  name: string;
  generateNextAction: (
    goal: string,
    history: LLMMessage[],
    availableTools: Array<{ name: string; description: string; inputSchema: any }>,
    memory: Record<string, any>
  ) => Promise<LLMDecision>;
}
