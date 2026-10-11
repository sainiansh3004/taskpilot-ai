import type { VerificationResult } from '../types/index.js';

export class VerificationEngine {
  private portalUrl: string;

  constructor(portalUrl = 'http://localhost:4001') {
    this.portalUrl = portalUrl;
  }

  public async verifyTaskCompletion(
    goal: string,
    memory: Record<string, any>
  ): Promise<VerificationResult> {
    const conditions: VerificationResult['checkedConditions'] = [];
    const evidence: Record<string, any> = {
      verifiedAt: new Date().toISOString(),
      goal,
      memorySnapshot: { ...memory }
    };

    const goalLower = goal.toLowerCase();

    // 1. Check for Duplicate Detection Scenario (e.g., Umbrella Inc)
    if (goalLower.includes('umbrella') || memory.duplicateDetected) {
      const duplicateDetected = Boolean(memory.duplicateDetected || memory.error?.includes('DUPLICATE_RECORD'));
      conditions.push({
        name: 'Duplicate Record Safe Handling',
        passed: duplicateDetected,
        expected: true,
        actual: duplicateDetected,
        details: duplicateDetected
          ? 'Agent correctly identified existing record and prevented duplicate record creation.'
          : 'Agent failed to detect existing duplicate record.'
      });

      evidence.duplicateDetected = duplicateDetected;
      const passedCount = conditions.filter(c => c.passed).length;
      return {
        verified: duplicateDetected,
        score: duplicateDetected ? 1.0 : 0.0,
        checkedConditions: conditions,
        evidence,
        summary: duplicateDetected
          ? 'VERIFIED: Duplicate record was successfully intercepted and prevented without corrupting ledger.'
          : 'VERIFICATION_FAILED: Existing duplicate invoice was not detected.'
      };
    }

    // 2. Check for Incomplete/Missing Fields Scenario (e.g., Wayne Enterprises)
    if (goalLower.includes('wayne') || memory.missingFieldDetected) {
      const missingDetected = Boolean(memory.missingFieldDetected || (memory.missingFields && memory.missingFields.length > 0));
      conditions.push({
        name: 'Missing Required Fields Identification',
        passed: missingDetected,
        expected: true,
        actual: missingDetected,
        details: missingDetected
          ? `Agent correctly flagged missing fields: ${(memory.missingFields || ['dueDate']).join(', ')}`
          : 'Agent failed to identify missing fields on incomplete invoice.'
      });

      evidence.missingFields = memory.missingFields || ['dueDate'];
      return {
        verified: missingDetected,
        score: missingDetected ? 1.0 : 0.0,
        checkedConditions: conditions,
        evidence,
        summary: missingDetected
          ? 'VERIFIED: Incomplete invoice missing required fields was accurately detected and reported.'
          : 'VERIFICATION_FAILED: Missing invoice fields were not identified.'
      };
    }

    // 3. Standard Invoice Record Entry & Verification (e.g., Acme Ltd, Globex, etc.)
    const invoiceNumber = memory.invoiceNumber || memory.selectedInvoice?.invoiceNumber || memory.createdRecord?.invoiceNumber;
    const companyName = memory.companyName || memory.selectedInvoice?.companyName;

    if (!invoiceNumber) {
      conditions.push({
        name: 'Invoice Number Identified',
        passed: false,
        expected: 'Non-empty invoice number',
        actual: null,
        details: 'No invoice number was found in agent working memory.'
      });

      return {
        verified: false,
        score: 0.0,
        checkedConditions: conditions,
        evidence,
        summary: 'VERIFICATION_FAILED: Agent did not identify or process an invoice number.'
      };
    }

    conditions.push({
      name: 'Invoice Number Identified',
      passed: true,
      expected: invoiceNumber,
      actual: invoiceNumber
    });

    // Query actual portal ledger independently via HTTP
    try {
      const recordRes = await fetch(`${this.portalUrl}/api/records/${encodeURIComponent(invoiceNumber)}`);
      if (!recordRes.ok) {
        conditions.push({
          name: 'Ledger Record Exists in Storage',
          passed: false,
          expected: `Persisted record for ${invoiceNumber}`,
          actual: `HTTP ${recordRes.status}`,
          details: `Invoice record '${invoiceNumber}' was NOT found in the internal portal database.`
        });

        return {
          verified: false,
          score: 0.2,
          checkedConditions: conditions,
          evidence,
          summary: `VERIFICATION_FAILED: Record for invoice '${invoiceNumber}' does not exist in persistent ledger.`
        };
      }

      const recordData = await recordRes.json() as any;
      const savedRecord = recordData.record;
      evidence.savedRecord = savedRecord;

      conditions.push({
        name: 'Ledger Record Exists in Storage',
        passed: true,
        expected: true,
        actual: true,
        details: `Found record ID: ${savedRecord.id}`
      });

      // Verify fields against source invoice
      if (savedRecord.invoiceId) {
        const sourceRes = await fetch(`${this.portalUrl}/api/invoices/${encodeURIComponent(savedRecord.invoiceId)}`);
        if (sourceRes.ok) {
          const sourceData = await sourceRes.json() as any;
          const sourceInvoice = sourceData.invoice;
          evidence.sourceInvoice = sourceInvoice;

          // Check Company Name
          const compMatch = sourceInvoice.companyName.toLowerCase().includes(savedRecord.companyName.toLowerCase()) ||
                            savedRecord.companyName.toLowerCase().includes(sourceInvoice.companyName.toLowerCase());
          conditions.push({
            name: 'Company Name Matches Source',
            passed: compMatch,
            expected: sourceInvoice.companyName,
            actual: savedRecord.companyName
          });

          // Check Amount
          const amountMatch = Math.abs(sourceInvoice.amount - savedRecord.amount) < 0.01;
          conditions.push({
            name: 'Amount Matches Source',
            passed: amountMatch,
            expected: sourceInvoice.amount,
            actual: savedRecord.amount
          });

          // Check Due Date
          const dueDateMatch = sourceInvoice.dueDate === savedRecord.dueDate;
          conditions.push({
            name: 'Due Date Matches Source',
            passed: dueDateMatch,
            expected: sourceInvoice.dueDate,
            actual: savedRecord.dueDate
          });

          // Check "Latest" if requested in goal
          if (goalLower.includes('latest')) {
            const listRes = await fetch(`${this.portalUrl}/api/invoices?search=${encodeURIComponent(sourceInvoice.companyName)}`);
            if (listRes.ok) {
              const listData = await listRes.json() as any;
              const companyInvoices = listData.invoices as Array<{ issueDate: string; invoiceNumber: string }>;
              if (companyInvoices.length > 0) {
                // Sorted by issueDate desc
                const latestNum = companyInvoices[0].invoiceNumber;
                const isLatest = savedRecord.invoiceNumber === latestNum;
                conditions.push({
                  name: 'Latest Invoice Selected',
                  passed: isLatest,
                  expected: latestNum,
                  actual: savedRecord.invoiceNumber,
                  details: isLatest
                    ? `Verified that ${savedRecord.invoiceNumber} is the most recent invoice (Date: ${companyInvoices[0].issueDate})`
                    : `Selected ${savedRecord.invoiceNumber}, but latest was ${latestNum}`
                });
              }
            }
          }
        }
      }

      // Check screenshot evidence if present
      if (memory.screenshot) {
        evidence.screenshot = memory.screenshot;
        conditions.push({
          name: 'Visual Screenshot Evidence Captured',
          passed: true,
          expected: 'Screenshot file',
          actual: memory.screenshot
        });
      }

      const totalChecks = conditions.length;
      const passedChecks = conditions.filter(c => c.passed).length;
      const score = totalChecks > 0 ? passedChecks / totalChecks : 0;
      const verified = conditions.every(c => c.passed);

      return {
        verified,
        score,
        checkedConditions: conditions,
        evidence,
        summary: verified
          ? `VERIFIED SUCCESS: All ${totalChecks} postconditions passed. Record ${savedRecord.invoiceNumber} correctly entered ($${savedRecord.amount}, due ${savedRecord.dueDate}) and verified against source.`
          : `PARTIAL / FAILED: Only ${passedChecks}/${totalChecks} conditions passed.`
      };
    } catch (err: any) {
      return {
        verified: false,
        score: 0.0,
        checkedConditions: conditions,
        evidence,
        summary: `VERIFICATION_ERROR: Could not verify system state due to network/storage error: ${err.message}`
      };
    }
  }
}
