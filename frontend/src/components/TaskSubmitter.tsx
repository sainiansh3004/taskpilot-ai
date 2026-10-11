'use client';

import React, { useState } from 'react';
import { Play, Sparkles, AlertCircle, Loader2 } from 'lucide-react';

interface TaskSubmitterProps {
  onSubmit: (goal: string) => Promise<void>;
  isLoading: boolean;
}

export function TaskSubmitter({ onSubmit, isLoading }: TaskSubmitterProps) {
  const [goal, setGoal] = useState('');
  const [error, setError] = useState<string | null>(null);

  const sampleScenarios = [
    {
      title: '🎯 Acme Ltd (Primary Demo)',
      prompt: 'Find the latest invoice from Acme Ltd, extract its amount and due date, enter it into the internal invoice system, verify the saved record, and report the outcome.'
    },
    {
      title: '🛡️ Umbrella Inc (Duplicate Check)',
      prompt: 'Process invoice for Umbrella Inc and record in system.'
    },
    {
      title: '⚠️ Wayne Enterprises (Missing Field)',
      prompt: 'Process invoice for Wayne Enterprises.'
    },
    {
      title: '❓ Nova Dynamics (Ambiguity Clarification)',
      prompt: 'Process invoice for Nova Dynamics.'
    },
    {
      title: '📄 Local Documents Analysis',
      prompt: 'List and read sample invoice documents in repository, then extract structured fields.'
    },
    {
      title: '🌐 Browser Portal Automation',
      prompt: 'Open simulated company portal via browser, inspect invoices table, and fill record creation form.'
    }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal.trim()) {
      setError('Please enter a business task goal.');
      return;
    }
    setError(null);
    try {
      await onSubmit(goal.trim());
    } catch (err: any) {
      setError(err.message || 'Failed to submit task');
    }
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-slate-100 text-sm">Autonomous Task Objective</h2>
        </div>
        <span className="text-xs text-slate-400">Natural-Language Business Goal</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            disabled={isLoading}
            placeholder="Describe the end goal in natural language (e.g. Find latest invoice from Acme Ltd, extract amount and due date, enter into internal system, and verify)..."
            rows={3}
            className="w-full rounded-lg bg-surfaceMuted/50 border border-border p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors resize-none"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 p-2.5 rounded-md bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-slate-500 font-medium mr-1">Quick Scenarios:</span>
            {sampleScenarios.map((sc, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setGoal(sc.prompt)}
                disabled={isLoading}
                className="px-2.5 py-1 rounded text-xs bg-surfaceMuted hover:bg-slate-700/80 border border-border text-slate-300 transition-colors"
              >
                {sc.title}
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={isLoading || !goal.trim()}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary hover:bg-primary-hover text-background font-semibold text-sm transition-all shadow-md shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Orchestrating...</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-current" />
                <span>Execute Task</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
