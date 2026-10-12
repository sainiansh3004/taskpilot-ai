'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from '../components/Navbar';
import { DashboardStats } from '../components/DashboardStats';
import { TaskSubmitter } from '../components/TaskSubmitter';
import { ExecutionTimeline } from '../components/ExecutionTimeline';
import { VerificationCard } from '../components/VerificationCard';
import { ApprovalDialog } from '../components/ApprovalDialog';
import { ClarificationDialog } from '../components/ClarificationDialog';
import { PortalModal } from '../components/PortalModal';
import {
  API_BASE,
  fetchStats,
  fetchTasks,
  fetchTask,
  fetchTaskEvents,
  createTask,
  cancelTask,
  approveTask,
  clarifyTask
} from '../lib/api';
import type { TaskRecord, ExecutionEvent, DashboardStats as StatsType } from '../types';
import { History, XCircle, RefreshCw, Cpu, CheckCircle2 } from 'lucide-react';

export default function Home() {
  const [stats, setStats] = useState<StatsType | null>(null);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [activeTask, setActiveTask] = useState<TaskRecord | null>(null);
  const [events, setEvents] = useState<ExecutionEvent[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPortalModalOpen, setIsPortalModalOpen] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const loadInitialData = async () => {
    try {
      const [s, tList] = await Promise.all([
        fetchStats().catch(() => null),
        fetchTasks().catch(() => [])
      ]);
      if (s) setStats(s);
      if (tList) {
        setTasks(tList);
        if (tList.length > 0 && !activeTask) {
          selectTask(tList[0]);
        }
      }
    } catch (err) {
      console.error('Error loading initial data:', err);
    }
  };

  useEffect(() => {
    loadInitialData();
    const interval = setInterval(() => {
      fetchStats().then(s => setStats(s)).catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const connectSSE = (taskId: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const es = new EventSource(`${API_BASE}/tasks/${encodeURIComponent(taskId)}/stream`);
    eventSourceRef.current = es;

    es.onmessage = (e) => {
      try {
        const evt: ExecutionEvent = JSON.parse(e.data);
        setEvents((prev) => {
          if (prev.some(x => x.id === evt.id)) return prev;
          return [...prev, evt];
        });

        // Instantly reflect state changes from event payload
        if (evt.eventType === 'task_completed') {
          const finalStatus = (evt.payload.status as any) || 'succeeded';
          setActiveTask(prev => prev ? {
            ...prev,
            status: finalStatus,
            summary: evt.payload.summary,
            evidence: evt.payload.evidence,
            completedAt: evt.timestamp
          } : null);
          setTasks(prev => prev.map(item => item.id === taskId ? {
            ...item,
            status: finalStatus,
            summary: evt.payload.summary,
            evidence: evt.payload.evidence,
            completedAt: evt.timestamp
          } : item));
        } else if (evt.eventType === 'verification_passed' || evt.eventType === 'verification_failed') {
          setActiveTask(prev => prev ? {
            ...prev,
            evidence: {
              ...(prev.evidence || {}),
              verification: evt.payload.verification || evt.payload,
              checkedConditions: evt.payload.verification?.checks || prev.evidence?.checkedConditions
            }
          } : null);
        } else if (evt.eventType === 'approval_requested') {
          setActiveTask(prev => prev ? {
            ...prev,
            status: 'awaiting_approval',
            pendingApproval: evt.payload as any
          } : null);
        } else if (evt.eventType === 'clarification_requested') {
          setActiveTask(prev => prev ? {
            ...prev,
            status: 'awaiting_clarification',
            pendingClarification: evt.payload as any
          } : null);
        } else if (evt.eventType === 'plan_created') {
          setActiveTask(prev => prev ? {
            ...prev,
            plan: evt.payload.plan
          } : null);
        } else if (evt.eventType === 'subgoal_set') {
          setActiveTask(prev => prev ? {
            ...prev,
            currentSubgoal: evt.payload.subgoal
          } : null);
        }

        // Also attempt background sync
        if (['task_completed', 'approval_requested', 'clarification_requested', 'verification_passed', 'verification_failed'].includes(evt.eventType)) {
          fetchTask(taskId).then((t) => {
            if (t) {
              setActiveTask(t);
              setTasks((prev) => prev.map(item => item.id === t.id ? t : item));
            }
          }).catch(() => {});
          fetchStats().then(s => setStats(s)).catch(() => {});
        }
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    };

    es.onerror = () => {
      // Stream closed or error
      es.close();
    };
  };

  const selectTask = async (task: TaskRecord) => {
    setActiveTask(task);
    try {
      const evts = await fetchTaskEvents(task.id);
      setEvents(evts);
      if (['queued', 'running', 'awaiting_approval', 'awaiting_clarification'].includes(task.status)) {
        connectSSE(task.id);
      } else {
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTaskSubmit = async (goal: string) => {
    setIsSubmitting(true);
    try {
      const task = await createTask(goal);
      setActiveTask(task);
      setEvents([]);
      setTasks(prev => [task, ...prev]);
      connectSSE(task.id);
      fetchStats().then(s => setStats(s)).catch(() => {});
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!activeTask) return;
    try {
      await cancelTask(activeTask.id);
      const updated = await fetchTask(activeTask.id);
      setActiveTask(updated);
      setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
    } catch (err) {
      console.error(err);
    }
  };

  const handleResolveApproval = async (approved: boolean) => {
    if (!activeTask) return;
    await approveTask(activeTask.id, approved);
    const updated = await fetchTask(activeTask.id);
    setActiveTask(updated);
  };

  const handleResolveClarification = async (response: string) => {
    if (!activeTask) return;
    await clarifyTask(activeTask.id, response);
    const updated = await fetchTask(activeTask.id);
    setActiveTask(updated);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar onOpenPortal={() => setIsPortalModalOpen(true)} />

      <main className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full space-y-6">
        {/* Metric Summary Cards */}
        <DashboardStats stats={stats} />

        {/* Task Objective Submitter */}
        <TaskSubmitter onSubmit={handleTaskSubmit} isLoading={isSubmitting} />

        {/* Main 2-Column Execution Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Active Execution Timeline & Live Telemetry (2 cols wide) */}
          <div className="lg:col-span-2 space-y-6">
            {activeTask && (
              <div className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-surfaceMuted flex items-center justify-center">
                    <Cpu className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-slate-200">Active Task ID:</span>
                      <code className="text-xs text-cyan-400 font-mono">{activeTask.id}</code>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-1 max-w-md">"{activeTask.goal}"</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {['running', 'awaiting_approval', 'awaiting_clarification'].includes(activeTask.status) && (
                    <button
                      onClick={handleCancel}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800 text-xs text-rose-300 font-medium transition-colors"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      <span>Cancel Task</span>
                    </button>
                  )}
                  <button
                    onClick={() => selectTask(activeTask)}
                    className="p-1.5 rounded-lg bg-surfaceMuted hover:bg-slate-700 border border-border text-slate-400 hover:text-slate-200"
                    title="Refresh Task Trace"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Execution Events Timeline */}
            <ExecutionTimeline events={events} />
          </div>

          {/* Right Column: Independent Verification Evidence & Task History (1 col wide) */}
          <div className="space-y-6">
            {/* Verification Card */}
            {activeTask && <VerificationCard task={activeTask} />}

            {/* Task History Panel */}
            <div className="bg-surface border border-border rounded-xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2.5">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-slate-100 text-xs uppercase tracking-wider">Execution History</h3>
                </div>
                <span className="text-[11px] text-slate-400">{tasks.length} Saved Tasks</span>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {tasks.map(t => {
                  const isSelected = activeTask?.id === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => selectTask(t)}
                      className={`w-full text-left p-2.5 rounded-lg border transition-all text-xs flex flex-col gap-1 ${
                        isSelected
                          ? 'bg-primary/10 border-primary/50 text-slate-100'
                          : 'bg-surfaceMuted/30 hover:bg-surfaceMuted border-border/60 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <code className="text-[10px] text-cyan-400 font-mono">{t.id}</code>
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                          t.status === 'succeeded' ? 'bg-emerald-500/20 text-emerald-400' :
                          t.status === 'failed' ? 'bg-rose-500/20 text-rose-400' :
                          t.status === 'awaiting_approval' ? 'bg-amber-500/20 text-amber-400' :
                          t.status === 'awaiting_clarification' ? 'bg-cyan-500/20 text-cyan-400' :
                          'bg-blue-500/20 text-blue-400'
                        }`}>
                          {t.status}
                        </span>
                      </div>
                      <p className="line-clamp-2 text-slate-300 text-[11px] font-medium leading-relaxed">{t.goal}</p>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 mt-0.5">
                        <span>{new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <span>{t.stepsCount} steps</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Human Approval Modal */}
      {activeTask?.status === 'awaiting_approval' && activeTask.pendingApproval && (
        <ApprovalDialog
          approval={activeTask.pendingApproval}
          onResolve={handleResolveApproval}
        />
      )}

      {/* Human Clarification Modal */}
      {activeTask?.status === 'awaiting_clarification' && activeTask.pendingClarification && (
        <ClarificationDialog
          clarification={activeTask.pendingClarification}
          onResolve={handleResolveClarification}
        />
      )}

      {/* Simulated Enterprise Portal Modal */}
      <PortalModal
        isOpen={isPortalModalOpen}
        onClose={() => setIsPortalModalOpen(false)}
      />
    </div>
  );
}
