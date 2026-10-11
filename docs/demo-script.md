# TaskPilot AI — Demonstration Walkthrough & Video Script

This script provides a step-by-step walkthrough for demonstrating TaskPilot AI live or recording a concise submission demonstration.

---

## 1. Setup & Pre-Flight Check

### Terminal 1: Launch System
In the project root (`taskpilot-ai`):
```bash
# Start all 3 services concurrently (Portal on 4001, Backend on 4000, Frontend on 3000)
npm run dev
```

### Browser:
Open `http://localhost:3000` to access the **TaskPilot AI Control Center**.

---

## 2. Demonstration Workflows

### Scenario 1: Primary Enterprise Invoice Processing (Acme Ltd)
1. **Action**: In the Natural-Language Task Editor, click the quick scenario button:
   > **🎯 Acme Ltd (Primary Demo)**
   > *"Find the latest invoice from Acme Ltd, extract its amount and due date, enter it into the internal invoice system, verify the saved record, and report the outcome."*
2. **Click**: **Execute Task**.
3. **What to Observe**:
   - The status updates from `queued` to `running`.
   - The agent decomposes the goal into a structured plan:
     1. Search portal invoices for Acme Ltd.
     2. Identify latest invoice and extract amount and due date.
     3. Check for existing duplicate record in ledger.
     4. Create record in internal system.
     5. Independently verify entered record against source invoice.
   - The live SSE timeline streams each step with tool names, thoughts, arguments, and duration.
   - The agent calls `search_invoices`, discovers two invoices (`INV-2024-012` and `INV-2024-098`), accurately isolates the latest invoice (`INV-2024-098`, issued 2024-05-10), calls `read_invoice`, checks the ledger, calls `create_invoice_record`, and triggers `verify_invoice_record`.
   - **Verification**: The Independent Verification Engine queries SQLite, validates the record against source data, and displays the **VERIFIED SUCCESS (100%)** badge with all 5 passing postcondition audits!

---

### Scenario 2: Duplicate Detection & Ledger Protection (Umbrella Inc)
1. **Action**: Click the quick scenario button:
   > **🛡️ Umbrella Inc (Duplicate Check)**
   > *"Process invoice for Umbrella Inc and record in system."*
2. **Click**: **Execute Task**.
3. **What to Observe**:
   - The agent queries the internal ledger before writing.
   - It discovers that `INV-2024-301` already exists (`rec-existing-umbrella`).
   - The agent halts safely without corrupting the financial ledger with a duplicate entry.
   - Independent verification confirms duplicate interception.

---

### Scenario 3: Incomplete Data & Missing Fields (Wayne Enterprises)
1. **Action**: Click the quick scenario button:
   > **⚠️ Wayne Enterprises (Missing Field)**
   > *"Process invoice for Wayne Enterprises."*
2. **Click**: **Execute Task**.
3. **What to Observe**:
   - The agent inspects `inv-wayne-401`.
   - It detects that the `dueDate` field is missing.
   - The agent halts execution, flags the missing field, and refuses to enter bad data.

---

### Scenario 4: Human-in-the-Loop Clarification (Nova Dynamics)
1. **Action**: Click the quick scenario button:
   > **❓ Nova Dynamics (Ambiguity Clarification)**
   > *"Process invoice for Nova Dynamics."*
2. **Click**: **Execute Task**.
3. **What to Observe**:
   - The agent identifies that the vendor name is ambiguous (`Nova Dynamics Ltd` vs `Nova Dynamics Global`).
   - Task status transitions to `awaiting_clarification`.
   - The Clarification Dialog appears on screen with options.
   - Click **👉 Nova Dynamics Ltd (Regional)**.
   - The agent immediately resumes and proceeds with the specified entity.

---

### Scenario 5: Playwright Browser Automation with Visual Screenshots
1. **Action**: Click:
   > **🌐 Browser Portal Automation**
   > *"Open simulated company portal via browser, inspect invoices table, and fill record creation form."*
2. **Click**: **Execute Task**.
3. **What to Observe**:
   - Headless Playwright launches against `http://localhost:4001`.
   - Extracts `#invoices-table` rows into structured JSON.
   - Automatically populates the form in the DOM.
   - Captures a full-page screenshot saved to `./screenshots/` and embedded directly in the Verification Card as visual evidence!
