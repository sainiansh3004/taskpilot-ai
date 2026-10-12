import OpenAI from 'openai';
import type { LLMProvider, LLMMessage, LLMDecision } from './types.js';

export class OpenAIProvider implements LLMProvider {
  public name = 'OpenAI';
  private client: OpenAI;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    const key = apiKey || process.env.OPENAI_API_KEY;
    if (!key) {
      throw new Error('OPENAI_API_KEY is not defined in environment.');
    }
    this.client = new OpenAI({ apiKey: key });
    this.model = model || process.env.OPENAI_MODEL || 'gpt-4o-mini';
  }

  public async generateNextAction(
    goal: string,
    history: LLMMessage[],
    availableTools: Array<{ name: string; description: string; inputSchema: any; openAISchema?: any }>,
    memory: Record<string, any>
  ): Promise<LLMDecision> {
    const systemPrompt = `You are TaskPilot AI, an autonomous enterprise AI employee.
Your mission is to accomplish the user's business goal in a controlled enterprise environment.
Goal: "${goal}"

Operational Rules:
1. Break down the task into logical subgoals and follow a plan-act-observe loop.
2. Select tools from the provided catalog to inspect data, execute browser automation, or write records.
3. Observe tool results and adapt to errors, missing data, or duplicate records.
4. If an action fails or returns an error, examine the cause and attempt an appropriate recovery or alternative tool.
5. If you detect that an invoice is already recorded, or missing critical fields, stop and explain rather than creating bad data.
6. If the target company or instruction is ambiguous with multiple possibilities, call request_clarification.
7. Consequential write actions require authorization: you may call request_approval first.
8. Once you have completed all required actions and verified the state, return your final answer.`;

    const openAITools = availableTools.map(t => {
      if (t.openAISchema) {
        return t.openAISchema;
      }
      return {
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      };
    });

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...history.map(m => {
        if (m.role === 'tool') {
          return {
            role: 'tool' as const,
            tool_call_id: m.tool_call_id || 'unknown',
            content: m.content
          };
        }
        if (m.role === 'assistant' && m.tool_calls) {
          return {
            role: 'assistant' as const,
            content: m.content || null,
            tool_calls: m.tool_calls.map(tc => ({
              id: tc.id,
              type: 'function' as const,
              function: tc.function
            }))
          };
        }
        return {
          role: m.role as 'user' | 'assistant',
          content: m.content
        };
      })
    ];

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages,
        tools: openAITools.length > 0 ? openAITools : undefined,
        tool_choice: 'auto',
        temperature: 0.1
      });

      const choice = completion.choices[0]?.message;
      if (!choice) {
        throw new Error('OpenAI returned empty choice response.');
      }

      if (choice.tool_calls && choice.tool_calls.length > 0) {
        const tc = choice.tool_calls[0];
        const parsedArgs = JSON.parse(tc.function.arguments || '{}');
        return {
          thought: choice.content || `Decided to execute tool ${tc.function.name}`,
          toolCall: {
            id: tc.id,
            name: tc.function.name,
            arguments: parsedArgs
          }
        };
      }

      return {
        thought: choice.content || 'Completed task.',
        isFinished: true,
        finalAnswer: choice.content || 'Task execution finished.'
      };
    } catch (err: any) {
      throw new Error(`OpenAI API Error: ${err.message}`);
    }
  }
}
