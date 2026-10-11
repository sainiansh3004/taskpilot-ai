import type { LLMProvider } from './types.js';
import { OpenAIProvider } from './openaiProvider.js';
import { AutonomousDeterministicProvider } from './autonomousDeterministicProvider.js';

export function getLLMProvider(): LLMProvider {
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim().length > 0) {
    try {
      return new OpenAIProvider();
    } catch (err) {
      console.warn('[LLM] Failed to initialize OpenAI provider, falling back to autonomous deterministic engine:', err);
      return new AutonomousDeterministicProvider();
    }
  }
  return new AutonomousDeterministicProvider();
}

export * from './types.js';
export { OpenAIProvider, AutonomousDeterministicProvider };
