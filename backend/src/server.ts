import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { TaskRepository } from './database/repository.js';
import { createDefaultToolRegistry } from './tools/index.js';
import { VerificationEngine } from './verification/engine.js';
import { getLLMProvider } from './llm/index.js';
import { AgentOrchestrator } from './agent/orchestrator.js';
import { createApiRouter } from './api/routes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOTS_DIR = path.resolve(__dirname, '../../screenshots');

export function createServerApp() {
  const app = express();

  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3001').split(',');
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or same-origin)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1 || origin.startsWith('http://localhost:')) {
        return callback(null, true);
      }
      return callback(null, true); // Dev-friendly permissive CORS
    },
    credentials: true
  }));

  app.use(express.json());

  // Static screenshots
  app.use('/screenshots', express.static(SCREENSHOTS_DIR));

  // Initialize Core Subsystems
  const repo = new TaskRepository();
  const tools = createDefaultToolRegistry();
  const portalUrl = process.env.SIMULATED_PORTAL_URL || 'http://localhost:4001';
  const verificationEngine = new VerificationEngine(portalUrl);
  const llm = getLLMProvider();

  const orchestrator = new AgentOrchestrator(repo, tools, verificationEngine, llm, {
    portalUrl,
    requireApprovalForWrites: process.env.REQUIRE_APPROVAL_FOR_WRITES === 'true'
  });

  // Health check
  app.get('/', (_req, res) => {
    res.send(`<!DOCTYPE html><html><body style="font-family: system-ui, sans-serif; background: #0a0f1d; color: #f8fafc; padding: 50px; text-align: center;"><h2>TaskPilot AI &mdash; Agent Backend API</h2><p style="color: #94a3b8;">The backend engine is running on port 4000.</p><p style="margin-top: 24px;"><a href="http://localhost:3000" style="color: #06b6d4; font-weight: bold; text-decoration: none; font-size: 18px; border: 1px solid #06b6d4; padding: 10px 20px; border-radius: 8px; display: inline-block;">&rarr; Open Frontend Control Center (http://localhost:3000)</a></p><p style="margin-top: 20px;"><a href="/health" style="color: #64748b; font-size: 13px;">View Backend Health JSON (/health)</a></p></body></html>`);
  });

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'taskpilot-backend',
      llmProvider: llm.name,
      toolsCount: tools.getAll().length,
      timestamp: new Date().toISOString()
    });
  });

  // Attach API routes
  app.use('/api', createApiRouter(orchestrator, repo, tools));

  return { app, repo, tools, orchestrator, verificationEngine, llm };
}

// Standalone runner
if (process.env.NODE_ENV !== 'test') {
  const PORT = parseInt(process.env.PORT || '4000', 10);
  const { app } = createServerApp();
  app.listen(PORT, () => {
    console.log(`[TaskPilot AI Backend] Running at http://localhost:${PORT}`);
  });
}
