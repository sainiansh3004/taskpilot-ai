'use client';

import React, { useState } from 'react';
import { ShieldAlert, Check, X, Loader2 } from 'lucide-react';
import type { PendingApproval } from '../types';

interface ApprovalDialogProps {
  approval: PendingApproval;
  onResolve: (approved: boolean) => Promise<void>;
}

export function ApprovalDialog({ approval, onResolve }: ApprovalDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  const handleAction = async (approved: boolean) => {
    setSubmitting(true);
    try {
      await onResolve(approved);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface border border-amber-500/50 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-base">Human Operator Authorization Required</h3>
            <p className="text-xs text-amber-400">Consequential Action Approval Gate</p>
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-slate-900/60 border border-border text-xs space-y-2 text-slate-300">
          <div>
            <span className="text-slate-400 block font-semibold mb-0.5">Proposed Action:</span>
            <code className="text-cyan-400 font-mono text-sm">{approval.toolName}()</code>
          </div>

          <div>
            <span className="text-slate-400 block font-semibold mb-0.5">Reason:</span>
            <p>{approval.reason}</p>
          </div>

          <div>
            <span className="text-slate-400 block font-semibold mb-0.5">Action Parameters:</span>
            <pre className="p-2 rounded bg-black/50 border border-slate-800 text-[11px] font-mono overflow-x-auto text-slate-200">
              {JSON.stringify(approval.toolArguments, null, 2)}
            </pre>
          </div>
        </div>

        <p className="text-xs text-slate-400">
          The autonomous agent has paused execution. Do you authorize this record creation / update?
        </p>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={() => handleAction(false)}
            disabled={submitting}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-200 text-xs font-semibold transition-colors disabled:opacity-50"
          >
            <X className="h-4 w-4" />
            <span>Reject Action</span>
          </button>

          <button
            onClick={() => handleAction(true)}
            disabled={submitting}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors disabled:opacity-50 shadow-md shadow-emerald-900/40"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            <span>Approve & Proceed</span>
          </button>
        </div>
      </div>
    </div>
  );
}
