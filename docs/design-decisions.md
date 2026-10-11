# TaskPilot AI — Engineering Design Decisions & Trade-Offs

## 1. Monorepo Architecture with npm Workspaces
- **Decision**: Structuring the project into 3 npm workspaces (`backend`, `simulated-company`, `frontend`) sharing a common `tsconfig.base.json`.
- **Rationale**: Isolates concerns cleanly. The simulated enterprise company portal acts as a standalone external target system, ensuring the AI agent interacts with it only through real HTTP requests or Playwright browser automation rather than in-memory cheating.
- **Trade-off**: Requires careful path and workspace management during local development and builds, resolved through root-level concurrency scripts.

## 2. Dual-Engine AI Architecture (OpenAI + Deterministic Engine)
- **Decision**: Implementing both the official OpenAI SDK tool-calling provider and a built-in Autonomous Deterministic Engine.
- **Rationale**: Evaluation criteria require real automated tests and a runnable out-of-the-box local demo. Relying strictly on a paid API key risks failure if an evaluator does not provide a key or encounters rate limits. When `OPENAI_API_KEY` is omitted, the autonomous engine executes the full plan-act-observe loop, tool selection, error handling, and recovery deterministically. When provided, real OpenAI models take over seamlessly.
- **Trade-off**: Requires maintaining deterministic heuristics in parallel with OpenAI prompt definitions.

## 3. Independent Verification vs. LLM Self-Evaluation
- **Decision**: Completely decoupling completion verification from the LLM's own self-reported text.
- **Rationale**: Language models are prone to hallucinated optimism—claiming "I have successfully entered the invoice" even when a write failed or saved corrupt values. TaskPilot AI's verification engine independently queries persistent storage, checks exact field equivalences (amount, due date, vendor, latest invoice ordering), and enforces that verified completion can only be achieved through verified system evidence.
- **Trade-off**: Requires writing domain-specific verification rules for enterprise operations.

## 4. SQLite with Better-SQLite3 and WAL Mode
- **Decision**: Using SQLite with `better-sqlite3` and Write-Ahead Logging (`WAL`) mode.
- **Rationale**: Provides zero-dependency, crash-resilient persistence across server restarts. Evaluators do not need to install or configure external database servers (like PostgreSQL or Redis). Tasks and execution events persist across backend restarts.
- **Trade-off**: SQLite is single-writer per database file; sufficient for single-node prototypes and internal testing.

## 5. Playwright Automation Restricted to Localhost Sandbox
- **Decision**: Sandboxing Playwright browser automation strictly to `http://localhost:4001`.
- **Rationale**: Enterprise agents operating in corporate environments must not execute arbitrary web navigation, download external malware, or leak internal credentials to third-party endpoints.
- **Trade-off**: The agent cannot browse the open public web, which aligns with safety requirements.

## 6. Server-Sent Events (SSE) for Real-Time Streaming
- **Decision**: Utilizing Server-Sent Events (`text/event-stream`) instead of full-duplex WebSockets.
- **Rationale**: Execution traces are fundamentally unidirectional server-to-client telemetry streams. SSE works over standard HTTP/1.1 and HTTP/2, requires no extra handshake infrastructure, and handles reconnections cleanly.
- **Trade-off**: Client-to-server interventions (approvals, clarifications) use standard REST POST endpoints, which is more semantically appropriate for audited actions.
