'use client';

import React, { useState } from 'react';
import { HelpCircle, Send, Loader2 } from 'lucide-react';
import type { PendingClarification } from '../types';

interface ClarificationDialogProps {
  clarification: PendingClarification;
  onResolve: (response: string) => Promise<void>;
}

export function ClarificationDialog({ clarification, onResolve }: ClarificationDialogProps) {
  const [response, setResponse] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (text: string) => {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      await onResolve(text.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface border border-cyan-500/50 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <HelpCircle className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-base">Agent Requests Clarification</h3>
            <p className="text-xs text-cyan-400">Ambiguous Goal / Multiple Possible Entities</p>
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-slate-900/60 border border-border text-xs text-slate-200">
          <p className="font-medium text-sm text-slate-100 mb-2">{clarification.question}</p>
          {clarification.options && clarification.options.length > 0 && (
            <div className="space-y-1.5 mt-3">
              <span className="text-[11px] text-slate-400 block font-semibold">Suggested Options:</span>
              <div className="flex flex-col gap-1.5">
                {clarification.options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => handleSubmit(opt)}
                    disabled={submitting}
                    className="text-left px-3 py-2 rounded bg-surfaceMuted hover:bg-slate-700/80 border border-border text-xs text-cyan-300 font-medium transition-colors"
                  >
                    👉 {opt}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-xs text-slate-400 block">Or provide custom instructions:</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && response.trim() && !submitting) {
                  e.preventDefault();
                  handleSubmit(response);
                }
              }}
              placeholder="e.g. Process Nova Dynamics Ltd..."
              disabled={submitting}
              className="flex-1 rounded-lg bg-surfaceMuted border border-border px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
            />
            <button
              type="button"
              onClick={() => handleSubmit(response)}
              disabled={submitting || !response.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-background text-xs font-semibold disabled:opacity-50 cursor-pointer"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span>Reply</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
