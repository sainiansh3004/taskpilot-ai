'use client';

import React from 'react';
import { ShieldCheck, Check, X, AlertTriangle, FileText, Image as ImageIcon } from 'lucide-react';
import { getScreenshotUrl } from '../lib/api';
import type { TaskRecord } from '../types';

interface VerificationCardProps {
  task: TaskRecord;
}

export function VerificationCard({ task }: VerificationCardProps) {
  const isComplete = ['succeeded', 'partially_succeeded', 'failed', 'budget_exhausted'].includes(task.status);
  const evidence = task.evidence || {};
  const conditions = evidence.checkedConditions || evidence.verification?.checks || [];
  const savedRecord = evidence.savedRecord || (evidence.recordId ? { id: evidence.recordId, invoiceNumber: evidence.invoiceNumber, companyName: evidence.companyName || evidence.vendor, amount: evidence.amount, dueDate: evidence.dueDate } : null);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'succeeded':
        return <span className="px-2.5 py-1 rounded text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">VERIFIED SUCCESS (100%)</span>;
      case 'partially_succeeded':
        return <span className="px-2.5 py-1 rounded text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">PARTIAL SUCCESS</span>;
      case 'failed':
        return <span className="px-2.5 py-1 rounded text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">VERIFICATION FAILED</span>;
      case 'budget_exhausted':
        return <span className="px-2.5 py-1 rounded text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30">BUDGET EXHAUSTED</span>;
      case 'awaiting_approval':
        return <span className="px-2.5 py-1 rounded text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">AWAITING APPROVAL</span>;
      case 'awaiting_clarification':
        return <span className="px-2.5 py-1 rounded text-xs font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">AWAITING CLARIFICATION</span>;
      default:
        return <span className="px-2.5 py-1 rounded text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">RUNNING ({task.stepsCount} steps)</span>;
    }
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <h3 className="font-semibold text-slate-100 text-sm">Independent Verification Engine</h3>
        </div>
        {getStatusBadge(task.status)}
      </div>

      {task.summary && (
        <div className="p-3 rounded-lg bg-surfaceMuted/50 border border-border text-xs text-slate-200">
          <span className="font-semibold text-slate-400 block mb-1">Execution Summary & Outcome:</span>
          <p>{task.summary}</p>
        </div>
      )}

      {/* Conditions Checklist */}
      {conditions.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Independent Postcondition Audit:</span>
          <div className="space-y-1.5">
            {conditions.map((c: any, i: number) => (
              <div
                key={i}
                className={`p-2.5 rounded-lg border text-xs flex items-start justify-between gap-2 ${
                  c.passed ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-200' : 'bg-rose-950/20 border-rose-800/40 text-rose-200'
                }`}
              >
                <div className="flex items-start gap-2">
                  {c.passed ? (
                    <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <X className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="font-semibold block">{c.name}</span>
                    {c.details && <span className="text-[11px] opacity-80">{c.details}</span>}
                  </div>
                </div>
                <span className="text-[10px] font-mono opacity-70 shrink-0">
                  {c.passed ? 'PASS' : 'FAIL'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Persisted Ledger Record Evidence */}
      {savedRecord && (
        <div className="p-3 rounded-lg bg-slate-900/60 border border-border text-xs space-y-2">
          <div className="flex items-center justify-between text-slate-400 font-semibold">
            <span className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-primary" />
              <span>Verified Persistent Ledger Record</span>
            </span>
            <code className="text-[11px] text-cyan-400">{savedRecord.id}</code>
          </div>

          <div className="grid grid-cols-2 gap-2 text-slate-300 text-[11px]">
            <div>Company: <strong>{savedRecord.companyName}</strong></div>
            <div>Invoice #: <strong>{savedRecord.invoiceNumber}</strong></div>
            <div>Amount: <strong className="text-emerald-400">${savedRecord.amount?.toFixed(2)} {savedRecord.currency || 'USD'}</strong></div>
            <div>Due Date: <strong>{savedRecord.dueDate}</strong></div>
          </div>
        </div>
      )}

      {/* Screenshot Evidence */}
      {evidence.screenshot && (
        <div className="p-3 rounded-lg bg-slate-900/60 border border-border text-xs space-y-2">
          <div className="flex items-center gap-1.5 text-slate-400 font-semibold">
            <ImageIcon className="h-3.5 w-3.5 text-primary" />
            <span>Captured Visual Screenshot Evidence</span>
          </div>
          <div className="rounded overflow-hidden border border-border/60">
            <img
              src={getScreenshotUrl(evidence.screenshot.relativePath)}
              alt="Browser Evidence Screenshot"
              className="w-full h-auto object-cover max-h-48"
            />
          </div>
        </div>
      )}
    </div>
  );
}
