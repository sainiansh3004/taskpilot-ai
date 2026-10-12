# TaskPilot AI — Autonomous Enterprise Task Execution Platform

> **CentrAlign AI Engineering Intern Hiring Assignment Submission**  
> **Author:** Ansh Saini  
> **Tagline:** *"Give it a goal. Watch it get the work done."*

---

## 1. Project Overview
**TaskPilot AI** is an autonomous enterprise AI employee built to solve business objectives inside controlled corporate environments. Unlike superficial chatbots or static dashboards, TaskPilot AI receives a high-level natural-language goal, autonomously decomposes it into structured subgoals, interacts with internal tools (APIs, sample document repositories, and sandboxed Playwright browser automation), observes real tool results, adapts to unexpected errors and duplicates, enforces human-in-the-loop approvals, and independently verifies that target state changes have been accurately committed to persistent storage.

---

## 2. Problem Statement
Enterprise automation frequently fails when relying either on rigid, hardcoded robotic process automation (RPA) scripts that break on minor DOM changes or on naive LLM wrappers that hallucinate completion without verifying real system state. Businesses require autonomous agents that:
1. Formulate dynamic multi-step plans from natural language.
2. Observe actual tool outputs and adapt to transient network failures or database errors.
3. Detect pre-existing duplicates and incomplete records before committing financial data.
4. Pause for explicit human operator authorization before executing consequential mutations.
5. Provide truthful, evidence-backed proof of verified completion.

---

## 3. Key Capabilities & Features
- **Bounded Autonomous Plan-Act-Observe Loop**: Strict budget bounds (max steps, max retries, action timeouts, overall duration limits).
- **Infinite Loop Detection**: Deterministic call signature tracking prevents infinite repetitions by halting when identical actions repeat 3 times.
- **Dual AI Engine**:
  - **OpenAI Tool Calling Provider**: Official OpenAI Responses / Function Calling API (`gpt-4o-mini`, `gpt-4o`).
  - **Autonomous Deterministic Engine**: Built-in zero-cost heuristic reasoning engine enabling 100% offline local evaluation and testing without requiring paid API keys!
- **Independent Verification Subsystem**: Decouples verification from LLM natural-language claims. Queries persistent SQLite storage and verifies vendor, amount, due date, and latest invoice ordering.
- **Human-in-the-Loop Safeguards**:
  - **Consequential Action Approval**: Automatically halts and prompts the operator before write actions when enabled.
  - **Ambiguity Clarification**: Asks for operator clarification when a vendor entity is ambiguous (e.g. `Nova Dynamics Ltd` vs `Nova Dynamics Global`).
- **Playwright Browser Automation**: Headless browser automation restricted to `localhost:4001` with screenshot evidence capture.
- **Simulated Enterprise Portal**: Standalone portal with vendor invoice intake, accounting ledger, search, validation, and configurable chaos failure modes.
- **Real-Time Telemetry & Timeline**: Next.js 15 App Router frontend streaming live Server-Sent Events (SSE).

---

## 4. Architecture Diagram

```
+-----------------------------------------------------------------------------------+
|                           TaskPilot AI Control Center                             |
|                        (Next.js 15 + Tailwind CSS on :3000)                       |
+-----------------------------------------------------------------------------------+
                                    | REST / SSE Stream
                                    v
+-----------------------------------------------------------------------------------+
|                        TaskPilot AI Backend Engine (:4000)                        |
|                                                                                   |
|  +--------------------+   +-----------------------+   +------------------------+  |
|  | Agent Orchestrator |<->| Dual AI Engine        |<->| Task-Scoped Memory     |  |
|  | - Step Bounding    |   | - OpenAI API Provider |   | - Subgoals & Findings  |  |
|  | - Loop Detection   |   | - Deterministic Engine|   | - Error & Retry Counts |  |
|  +--------------------+   +-----------------------+   +------------------------+  |
|            |                                                       ^              |
|            v                                                       |              |
|  +--------------------+   +-----------------------+                |              |
|  | Tool Registry      |   | Verification Engine   |----------------+              |
|  | - Zod Validation   |   | - Independent Queries |                               |
|  | - Side Effects Guard   | - Postcondition Audit |                               |
|  +--------------------+   +-----------------------+                               |
|            |                                                                       |
|            +-----------------------+-----------------------+                       |
|                                    |                       |                       |
|                                    v                       v                       |
|                          +-------------------+   +--------------------+            |
|                          | Playwright Browser|   | Document Extractor |            |
|                          | (Restricted Local)|   | (Sample Files)     |            |
|                          +-------------------+   +--------------------+            |
+-----------------------------------------------------------------------------------+
                                    | HTTP / DOM Automation
                                    v
+-----------------------------------------------------------------------------------+
|                  Simulated Enterprise Invoicing Portal (:4001)                    |
|        - Invoices Database (SQLite)        - Processed Ledger Table (SQLite)      |
|        - Search & Detail Endpoints         - Chaos Transient Failure Engine       |
+-----------------------------------------------------------------------------------+
```

---

## 5. Execution Loop Explanation
Every task execution follows a strict 8-phase state machine:
1. **Ingest & Validate**: Natural-language goal is stored in SQLite with initial status `queued`.
2. **Plan Synthesis**: Decomposes the goal into a sequence of subgoals (`plan_created`).
3. **Tool Selection**: Next permitted tool is selected based on active memory and observations.
4. **Guard Checks**: Zod input validation, loop detection signature check, and approval requirements are checked.
5. **Execution & Observation**: Tool runs with an explicit timeout. Results and durations are recorded as `execution_events`.
6. **Error Classification & Retry**: Transient errors (HTTP 500, timeouts) trigger exponential backoff retries (up to 3 attempts). Permanent errors (missing fields, duplicate records) halt safely.
7. **Independent Postcondition Audit**: The Verification Engine tests the actual database state against source records.
8. **Truthful Outcome Delivery**: Sets final status (`succeeded`, `partially_succeeded`, `failed`, `budget_exhausted`) with attached evidence.

---

## 6. Tool Catalog

| Tool Name | Type | Description |
|---|---|---|
| `search_invoices` | Read-Only | Search invoices by vendor name, invoice number, or query keyword. |
| `read_invoice` | Read-Only | Retrieve full details, line items, and terms for a specific invoice ID. |
| `list_invoice_records` | Read-Only | List all entered records in the internal accounting ledger. |
| `create_invoice_record` | Consequential Write | Commit an invoice into the internal financial accounting ledger. |
| `verify_invoice_record` | Read-Only | Compare entered ledger record against source invoice values. |
| `open_allowed_page` | Browser | Navigate Playwright browser to permitted local portal URL. |
| `inspect_page` | Browser | Inspect DOM element text and state on current portal page. |
| `click_element` | Browser | Click button or link by CSS selector / testid. |
| `fill_field` | Browser | Type values into input forms on the portal. |
| `extract_table` | Browser | Parse HTML table into structured JSON rows. |
| `capture_screenshot` | Browser | Capture full-page screenshot saved to `./screenshots/` as evidence. |
| `list_sample_documents`| Read-Only | List sample invoice files in repository. |
| `read_document` | Read-Only | Read raw text content of local sample documents. |
| `extract_supported_invoice_fields` | Read-Only | Parse structured metadata from invoice document text. |
| `request_approval` | Workflow | Trigger human approval pause before high-stakes actions. |
| `request_clarification`| Workflow | Prompt operator when goal is ambiguous. |
| `inspect_task_state` | Workflow | Inspect active working memory snapshot. |

---

## 7. Memory Design
TaskPilot AI maintains task-scoped working memory:
- **`goal`**: Original user objective.
- **`plan`**: High-level decomposition steps.
- **`currentSubgoal`**: Active step.
- **`selectedInvoice`**: Discovered source invoice details.
- **`createdRecord`**: Ledger record created during execution.
- **`duplicateDetected`**: Boolean flag preventing duplicate entry.
- **`missingFields`**: Array of missing required fields identified.
- **`screenshot`**: Relative path to captured visual evidence.

---

## 8. Verification Approach
The completion of a task is never decided by model claims. The `VerificationEngine` independently queries the portal database and audits:
1. Record existence in persistent storage.
2. Vendor name match against source invoice.
3. Amount match (exact currency value).
4. Due date match (`YYYY-MM-DD`).
5. Latest invoice selection verification.
6. Safe duplicate interception.
7. Incomplete field detection.

---

## 9. Safety & Human-in-the-Loop Model
- **No Unrestricted Shell**: The model cannot execute arbitrary terminal commands.
- **Strict Host Restraints**: Browser navigation is locked to `localhost:4001`; unauthorized external domains trigger `SECURITY_VIOLATION`.
- **Approval Gates**: Consequential actions pause execution and require operator authorization via UI before proceeding.
- **Clarification Prompts**: Multiple matching entities trigger interactive clarification rather than guessing.

---

## 10. Technology Stack
- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Lucide Icons.
- **Backend**: Node.js 22, Express.js, TypeScript, Zod, UUID.
- **AI**: OpenAI Responses / Function Calling API + Autonomous Deterministic Engine.
- **Browser Automation**: Playwright (Chromium).
- **Persistence**: SQLite with `better-sqlite3` (WAL mode).
- **Testing**: Vitest test runner.

---

## 11. Prerequisites
- **Operating System**: macOS (tested on Apple Silicon & Intel) or Linux.
- **Node.js**: v18.0.0 or higher (v22 recommended).
- **npm**: v9.0.0 or higher.

---

## 12. Setup Instructions (macOS)

```bash
# 1. Clone repository
git clone https://github.com/your-username/taskpilot-ai.git
cd taskpilot-ai

# 2. Install workspace dependencies
npm install

# 3. Install Playwright Chromium browser binary
npx playwright install chromium

# 4. Configure environment
cp .env.example .env
```

---

## 13. Environment Variable Setup
In `.env`:
```env
PORT=4000
SIMULATED_PORTAL_PORT=4001
SIMULATED_PORTAL_URL=http://localhost:4001
MAX_STEPS=15
MAX_RETRIES_PER_ACTION=3
REQUIRE_APPROVAL_FOR_WRITES=false

# Optional: To use real OpenAI models, supply your API key:
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```
*(If `OPENAI_API_KEY` is left blank, TaskPilot AI automatically operates using its built-in Autonomous Deterministic Engine out of the box!)*

---

## 14. Local Run Commands

To launch all 3 services concurrently:
```bash
npm run dev
```
- **Control Center (Frontend)**: `http://localhost:3000`
- **Agent Backend API**: `http://localhost:4000`
- **Simulated Company Portal**: `http://localhost:4001`

Or run services individually:
```bash
npm run dev:portal    # Simulated enterprise portal (:4001)
npm run dev:backend   # Agent orchestrator backend (:4000)
npm run dev:frontend  # Next.js control center (:3000)
```

---

## 15. Production Deployment (Vercel + Railway)

The frontend is deployed to Vercel. The agent backend and simulated portal are separate Railway services because they need long-running processes, Playwright, and persistent SQLite storage.

### Deploy the backend and portal to Railway

Create two Railway services from this repository. For both services, use the repository root as the build context and set the Dockerfile path to the corresponding file:

- Agent backend: `Dockerfile.backend`
- Simulated portal: `Dockerfile.portal`

For **each** service, attach a Railway Volume mounted at `/data`, then enable a public domain and configure the `/health` health-check path.

Set the agent backend service variables:

```env
DATABASE_PATH=/data/taskpilot.sqlite
SCREENSHOTS_DIR=/data/screenshots
SIMULATED_PORTAL_URL=https://YOUR-PORTAL-DOMAIN
ALLOWED_ORIGINS=https://YOUR-VERCEL-DOMAIN
REQUIRE_APPROVAL_FOR_WRITES=true
```

Set the portal service variables:

```env
PORTAL_DATABASE_PATH=/data/simulated_company.sqlite
ALLOWED_ORIGINS=https://YOUR-VERCEL-DOMAIN
```

Railway supplies `PORT` automatically. After both services have deployed, replace the placeholder domains above with their actual public URLs and redeploy the backend.

### Deploy the frontend to Vercel

Import the repository into Vercel as a Next.js project and set the project root directory to `frontend`. Enable **Include source files outside of the Root Directory**, since the frontend TypeScript configuration extends the repository-level `tsconfig.base.json`.

Set these Vercel environment variables for the environments you deploy:

```env
NEXT_PUBLIC_API_URL=https://YOUR-BACKEND-DOMAIN/api
NEXT_PUBLIC_PORTAL_URL=https://YOUR-PORTAL-DOMAIN
```

Deploy the frontend after setting these values. Add the resulting Vercel origin to `ALLOWED_ORIGINS` on both Railway services, and redeploy those services. Keep the Railway volume mounted: without it, SQLite data and screenshot evidence will not persist across deployments.

Leave `OPENAI_API_KEY` unset to use the built-in deterministic engine, or configure it on the backend Railway service to enable OpenAI.

---

## 16. Testing Commands

Run the automated test suite:
```bash
npm test
```
Runs 20 automated unit and integration tests across:
- Tool Registry schemas and Zod validation
- Autonomous orchestration and execution loops
- Duplicate detection & missing field handling
- Playwright browser automation
- Simulated company portal and chaos failure recovery

---

## 16. Sample Demonstration Tasks

1. **Primary Enterprise Workflow (Acme Ltd)**:
   > *"Find the latest invoice from Acme Ltd, extract its amount and due date, enter it into the internal invoice system, verify the saved record, and report the outcome."*
2. **Duplicate Prevention (Umbrella Inc)**:
   > *"Process invoice for Umbrella Inc and record in system."*
3. **Incomplete Invoice Detection (Wayne Enterprises)**:
   > *"Process invoice for Wayne Enterprises."*
4. **Ambiguity Clarification (Nova Dynamics)**:
   > *"Process invoice for Nova Dynamics."*
5. **Local Document Repository Analysis**:
   > *"List and read sample invoice documents in repository, then extract structured fields."*
6. **Browser Automation**:
   > *"Open simulated company portal via browser, inspect invoices table, and fill record creation form."*

---

## 17. Expected Outputs & Verification Results
- **Status**: `succeeded`
- **Verification Score**: `100%`
- **Audit Checks**: All postconditions pass (Record Exists, Vendor Matched, Amount Matched, Due Date Matched, Latest Selected).
- **Persistent Ledger**: New record visible in the internal portal table with unique ID.

---

## 18. Known Limitations
- Single SQLite writer: Concurrent high-throughput tasks should be upgraded to PostgreSQL for enterprise production.
- Browser automation is restricted to localhost sandbox to prevent uncontrolled public web access.

---

## 19. Assumptions
- Vendor invoices use standard calendar dates (`YYYY-MM-DD`).
- Invoices are denominated in standard currencies (default `USD`).

---

## 20. External Services Used
- OpenAI API (when `OPENAI_API_KEY` is provided; zero external dependencies when running in offline autonomous mode).

---

## 21. Design Trade-Offs
See `docs/design-decisions.md` for full discussion of:
- Monorepo workspaces vs single package
- Dual LLM engine for out-of-the-box zero-cost reproducibility
- Independent verification vs model self-evaluation
- SSE streaming vs WebSockets

---

## 22. Future Improvements
- Multi-tenant enterprise role-based access control (RBAC).
- Vector indexing for multi-thousand page contract repositories.
- Distributed workflow orchestration using Temporal.io.

---

## 23. Demo Instructions
See `docs/demo-script.md` for a complete live demonstration checklist and video recording walkthrough.
