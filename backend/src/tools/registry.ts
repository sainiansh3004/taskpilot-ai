import { z } from 'zod';
import type { ToolDefinition, AgentContext } from '../types/index.js';

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  public register(tool: ToolDefinition) {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool with name '${tool.name}' is already registered.`);
    }
    this.tools.set(tool.name, tool);
  }

  public get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  public getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  public getOpenAIToolSchemas() {
    return Array.from(this.tools.values()).map(tool => {
      // Generate OpenAI compatible tool description
      const shape = tool.inputSchema instanceof z.ZodObject ? tool.inputSchema.shape : {};
      const properties: Record<string, any> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(shape)) {
        let field = value as any;
        let isOptional = false;

        if (field._def?.typeName === 'ZodOptional') {
          isOptional = true;
          field = field._def.innerType;
        } else if (field._def?.typeName === 'ZodDefault') {
          isOptional = true;
          field = field._def.innerType;
        } else if (typeof field.isOptional === 'function' && field.isOptional()) {
          isOptional = true;
        }

        const typeName = field._def?.typeName;
        let jsonType = 'string';
        if (typeName === 'ZodNumber') jsonType = 'number';
        if (typeName === 'ZodBoolean') jsonType = 'boolean';
        if (typeName === 'ZodArray') jsonType = 'array';
        if (typeName === 'ZodObject' || typeName === 'ZodRecord') jsonType = 'object';

        properties[key] = {
          type: jsonType,
          description: field.description || key
        };

        if (!isOptional) {
          required.push(key);
        }
      }

      return {
        type: 'function' as const,
        function: {
          name: tool.name,
          description: `${tool.description} (Side Effect: ${tool.sideEffect})`,
          parameters: {
            type: 'object',
            properties,
            required
          }
        }
      };
    });
  }

  public async executeTool(
    name: string,
    rawArgs: any,
    context: AgentContext
  ): Promise<{ success: boolean; data?: any; error?: string; durationMs: number }> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        success: false,
        error: `TOOL_NOT_FOUND: Tool '${name}' is not registered in the restricted tool registry.`,
        durationMs: 0
      };
    }

    const startTime = Date.now();

    // 1. Validate Input Schema with Zod
    const validation = tool.inputSchema.safeParse(rawArgs);
    if (!validation.success) {
      const errorMsg = `ARGUMENT_VALIDATION_ERROR: ${validation.error.issues.map((i: any) => `${i.path.join('.')}: ${i.message}`).join(', ')}`;
      return {
        success: false,
        error: errorMsg,
        durationMs: Date.now() - startTime
      };
    }

    // 2. Consequential action approval guard
    if (tool.sideEffect === 'consequential_write' && context.requireApprovalForWrites) {
      const approved = await context.requestApproval(
        tool.name,
        validation.data,
        `Action '${tool.name}' is classified as consequential_write and requires explicit authorization.`
      );

      if (!approved) {
        return {
          success: false,
          error: `APPROVAL_DENIED: Action '${tool.name}' was rejected or not approved by the operator.`,
          durationMs: Date.now() - startTime
        };
      }
    }

    // 3. Execute with explicit timeout
    try {
      const executionPromise = tool.execute(validation.data, context);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`TOOL_TIMEOUT: Tool '${name}' exceeded timeout of ${tool.timeoutMs}ms.`)), tool.timeoutMs)
      );

      const result = await Promise.race([executionPromise, timeoutPromise]);
      const durationMs = Date.now() - startTime;

      return {
        success: true,
        data: result,
        durationMs
      };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      return {
        success: false,
        error: err.message || 'UNKNOWN_TOOL_EXECUTION_ERROR',
        durationMs
      };
    }
  }
}
