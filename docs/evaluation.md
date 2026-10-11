# TaskPilot AI — CentrAlign Assignment Evaluation Matrix

This document maps each requirement from the official CentrAlign AI Engineering Intern hiring assignment to its concrete implementation and verification tests in TaskPilot AI.

| # | Official Assignment Requirement | TaskPilot AI Implementation | Verification / Test Reference |
|---|---|---|---|
| **1** | Understand user's end goal from natural-language task | Task ingestion parses natural language, validates constraints, and constructs working memory. | `backend/src/agent/orchestrator.ts:startTask()` |
| **2** | Independently break the task into meaningful steps | Agent synthesizes dynamic multi-step plan (`plan_created`) and tracks immediate subgoals (`subgoal_set`). | `backend/tests/orchestrator.test.ts` (Plan synthesis test) |
| **3** | Use tools (browser, files, APIs, simulated company app) | Full Tool Catalog: 5 Invoice API tools, 6 Playwright browser tools, 3 Document tools, 3 Workflow tools. | `backend/tests/tools.test.ts` & `backend/tests/browser.test.ts` |
| **4** | Observe the result of each action | Execution events record inputs, stdout observations, and durations (`tool_call_completed`). | `backend/src/agent/orchestrator.ts` (Event emission) |
| **5** | Select subsequent actions based on observed result | Observations directly influence next step (e.g. search results determine latest invoice ID to read). | `backend/src/llm/autonomousDeterministicProvider.ts` |
| **6** | Remember relevant information discovered during execution | Task-scoped working memory stores selected invoice details, ledger records, errors, and extracted amounts. | `backend/src/types/index.ts:AgentContext` |
| **7** | Detect errors and unexpected states | Identifies duplicates, missing fields, 500 server errors, timeouts, and loops. | `simulated-company/tests/portal.test.ts` & `backend/tests/orchestrator.test.ts` |
| **8** | Attempt appropriate retries or alternative actions | Exponential backoff retry policy for transient errors (up to 3 retries); halts safely on non-retriable states. | `backend/src/agent/orchestrator.ts:line 340` |
| **9** | Verify whether the requested outcome was actually achieved | Independent `VerificationEngine` queries persistent storage and validates all postconditions before success. | `backend/src/verification/engine.ts` |
| **10** | Request clarification or human approval when required | Consequential write actions pause for approval (`awaiting_approval`); ambiguous entities trigger clarification (`awaiting_clarification`). | `backend/tests/orchestrator.test.ts` (Approval & Clarification tests) |
| **11** | Produce a concise summary and useful evidence | Reports final summary, persistent record ID, matched source data, and Playwright screenshot paths. | `backend/src/verification/engine.ts:VerificationResult` |
| **12** | Support more than one hardcoded task or workflow | Supports 6 distinct workflows: Acme invoice processing, Umbrella duplicate check, Wayne missing fields, Nova ambiguity, Document extraction, and Browser automation. | `backend/tests/orchestrator.test.ts` |
| **13** | Include clear architecture and engineering decisions | Documented in `docs/architecture.md` and `docs/design-decisions.md`. | `docs/architecture.md` |
| **14** | Provide setup instructions, limitations, and assumptions | Complete documentation in root `README.md`. | `README.md` |
| **15** | Include a working demonstration or accessible demo | Local runnable Next.js dashboard + script in `docs/demo-script.md`. | `docs/demo-script.md` |
