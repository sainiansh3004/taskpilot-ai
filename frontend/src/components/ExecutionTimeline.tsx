'use client';

import React, { useState } from 'react';
import {
  CheckCircle,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  Terminal,
  RotateCcw,
  ShieldAlert,
  HelpCircle,
  Search,
  FileCheck
} from 'lucide-react';
import type { ExecutionEvent } from '../types';

interface ExecutionTimelineProps {
  events: ExecutionEvent[];
}

export function ExecutionTimeline({ events }: ExecutionTimelineProps) {
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getEventBadge = (type: string) => {
    switch (type) {
      case 'task_started':
        return { label: 'STARTED', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
      case 'plan_created':
        return { label: 'PLAN SYNTHESIS', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' };
      case 'subgoal_set':
        return { label: 'SUBGOAL', color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' };
      case 'tool_call_started':
        return { label: 'TOOL CALL', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
      case 'tool_call_completed':
        return { label: 'OBSERVATION', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
      case 'tool_call_failed':
        return { label: 'FAILURE OBSERVED', color: 'bg-rose-500/20 text-rose-400 border-rose-500/30' };
      case 'retry_attempted':
        return { label: 'RETRY BACKOFF', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' };
      case 'approval_requested':
        return { label: 'APPROVAL REQUIRED', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
      case 'approval_resolved':
        return { label: 'APPROVAL RESOLVED', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
      case 'clarification_requested':
        return { label: 'CLARIFICATION NEEDED', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' };
      case 'verification_started':
        return { label: 'VERIFICATION', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' };
      case 'verification_passed':
        return { label: 'VERIFIED SUCCESS', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
      case 'verification_failed':
        return { label: 'VERIFICATION FAILED', color: 'bg-rose-500/20 text-rose-400 border-rose-500/30' };
      case 'loop_detected':
        return { label: 'LOOP DETECTED', color: 'bg-red-500/20 text-red-400 border-red-500/30' };
      case 'task_completed':
        return { label: 'COMPLETE', color: 'bg-teal-500/20 text-teal-400 border-teal-500/30' };
      default:
        return { label: type.toUpperCase(), color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' };
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'tool_call_completed':
      case 'verification_passed':
      case 'task_completed':
        return <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />;
      case 'tool_call_failed':
      case 'verification_failed':
      case 'loop_detected':
        return <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />;
      case 'retry_attempted':
        return <RotateCcw className="h-4 w-4 text-yellow-400 shrink-0" />;
      case 'approval_requested':
        return <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0" />;
      case 'clarification_requested':
        return <HelpCircle className="h-4 w-4 text-cyan-400 shrink-0" />;
      case 'tool_call_started':
        return <Terminal className="h-4 w-4 text-amber-400 shrink-0" />;
      default:
        return <Clock className="h-4 w-4 text-slate-400 shrink-0" />;
    }
  };

  if (events.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-xl p-8 text-center text-slate-500 text-sm">
        <Terminal className="h-8 w-8 mx-auto mb-2 text-slate-600" />
        <p>No active execution trace. Submit a business task above to observe live plan-act-observe events.</p>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-slate-100 text-sm">Execution Timeline & Telemetry</h3>
        </div>
        <span className="text-xs text-slate-400">{events.length} Recorded Steps</span>
      </div>

      <div className="space-y-3 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-slate-800">
        {events.map((evt, idx) => {
          const badge = getEventBadge(evt.eventType);
          const icon = getEventIcon(evt.eventType);
          const isExpanded = !!expandedIds[evt.id];
          const time = new Date(evt.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

          return (
            <div key={evt.id || idx} className="relative pl-8 text-sm">
              <div className="absolute left-1.5 top-1 bg-surface ring-4 ring-surface rounded-full">
                {icon}
              </div>

              <div className="p-3 rounded-lg bg-surfaceMuted/40 border border-border/70 hover:border-border transition-colors">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge.color}`}>
                      {badge.label}
                    </span>
                    {evt.payload.toolName && (
                      <span className="font-mono text-xs text-primary font-medium">
                        {evt.payload.toolName}()
                      </span>
                    )}
                    {evt.durationMs !== undefined && (
                      <span className="text-[11px] text-slate-500">
                        {evt.durationMs}ms
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-mono text-slate-500">{time}</span>
                </div>

                {evt.payload.subgoal && (
                  <p className="text-xs font-semibold text-slate-200 mt-1">
                    🎯 Subgoal: {evt.payload.subgoal}
                  </p>
                )}

                {evt.payload.thought && (
                  <p className="text-xs text-slate-300 italic mt-0.5">
                    💭 "{evt.payload.thought}"
                  </p>
                )}

                {evt.payload.plan && Array.isArray(evt.payload.plan) && (
                  <div className="mt-2 text-xs text-slate-300 bg-slate-900/50 p-2.5 rounded border border-border/40">
                    <span className="font-semibold text-cyan-400 block mb-1">Synthesized Decomposition Plan:</span>
                    <ol className="list-decimal list-inside space-y-0.5 text-slate-400">
                      {evt.payload.plan.map((step: string, sIdx: number) => (
                        <li key={sIdx}>{step}</li>
                      ))}
                    </ol>
                  </div>
                )}

                {evt.payload.error && (
                  <p className="text-xs text-rose-400 mt-1 font-mono">
                    ⚠️ Error: {evt.payload.error}
                  </p>
                )}

                {/* Expandable JSON payload details */}
                <div className="mt-2 pt-2 border-t border-border/30">
                  <button
                    onClick={() => toggleExpand(evt.id)}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    <span>{isExpanded ? 'Hide Raw Payload' : 'View Payload & Arguments'}</span>
                  </button>

                  {isExpanded && (
                    <pre className="mt-2 p-2.5 rounded bg-black/50 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-56">
                      {JSON.stringify(evt.payload, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
