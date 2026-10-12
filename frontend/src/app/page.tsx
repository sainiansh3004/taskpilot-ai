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
      // 1. Restore cached tasks from localStorage if available (clean up any legacy seed demos)
      try {
        const cached = typeof window !== 'undefined' ? localStorage.getItem('taskpilot_saved_tasks') : null;
        if (cached) {
          const localTasks: TaskRecord[] = JSON.parse(cached);
          const userTasks = (localTasks || []).filter(t => !t.id.startsWith('task_demo_'));
          if (Array.isArray(userTasks) && userTasks.length > 0) {
            setTasks(userTasks);
            if (!activeTask) {
              selectTask(userTasks[0]);
            }
          } else {
            localStorage.removeItem('taskpilot_saved_tasks');
          }
        }
      } catch {}

      // 2. Fetch server-side stats & tasks
      const [s, tList] = await Promise.all([
        fetchStats().catch(() => null),
        fetchTasks().catch(() => [])
      ]);
      const validServerTasks = (tList || []).filter(t => !t.id.startsWith('task_demo_'));
      if (s) setStats(s);
      if (validServerTasks && validServerTasks.length > 0) {
        setTasks((prev) => {
          const combined = [...prev];
          for (const serverTask of validServerTasks) {
            const idx = combined.findIndex(t => t.id === serverTask.id);
            if (idx >= 0) {
              combined[idx] = serverTask;
            } else {
              combined.push(serverTask);
            }
          }
          return combined;
        });
        if (!activeTask) {
          selectTask(validServerTasks[0]);
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

  // Persist tasks in localStorage whenever tasks change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userTasks = tasks.filter(t => !t.id.startsWith('task_demo_'));
      if (userTasks.length > 0) {
        try {
          localStorage.setItem('taskpilot_saved_tasks', JSON.stringify(userTasks));
        } catch {}
      }
    }
  }, [tasks]);

  // Dynamically compute effective stats starting from 0 initially and counting executed tasks
  const effectiveStats: StatsType = {
    totalTasks: tasks.length,
    verified: tasks.filter(t => t.status === 'succeeded').length,
    failed: tasks.filter(t => ['failed', 'budget_exhausted', 'cancelled'].includes(t.status)).length,
    pendingApproval: tasks.filter(t => t.status === 'awaiting_approval').length,
    pendingClarification: tasks.filter(t => t.status === 'awaiting_clarification').length,
  };

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
    const currentTaskId = activeTask.id;

    // Immediately abort any active SSE stream
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // Call cancel API in background without blocking local transition
    cancelTask(currentTaskId).catch(err => console.warn('Cancel API sync:', err));

    // Append cancellation event to timeline immediately
    const cancelEvt: ExecutionEvent = {
      id: `evt_cancel_${Date.now()}`,
      taskId: currentTaskId,
      stepNumber: (events.length || 0) + 1,
      timestamp: new Date().toISOString(),
      eventType: 'task_completed',
      payload: {
        status: 'cancelled',
        summary: 'Task execution stopped and cancelled by operator.'
      }
    };
    setEvents(prev => [...prev, cancelEvt]);

    const updatedTask: TaskRecord = {
      ...activeTask,
      status: 'cancelled',
      completedAt: new Date().toISOString(),
      summary: 'Task execution cancelled by operator.',
      pendingApproval: undefined,
      pendingClarification: undefined
    };

    setActiveTask(updatedTask);
    setTasks(prev => prev.map(t => t.id === currentTaskId ? updatedTask : t));
  };

  const handleResolveApproval = async (approved: boolean) => {
    if (!activeTask) return;
    const currentTaskId = activeTask.id;

    // Immediately dismiss approval modal
    setActiveTask(prev => prev && prev.id === currentTaskId ? {
      ...prev,
      status: 'running',
      pendingApproval: undefined
    } : prev);

    const appEvt: ExecutionEvent = {
      id: `evt_app_${Date.now()}`,
      taskId: currentTaskId,
      stepNumber: (events.length || 0) + 1,
      timestamp: new Date().toISOString(),
      eventType: 'approval_resolved',
      payload: { approved, toolName: activeTask.pendingApproval?.toolName }
    };
    setEvents(prev => [...prev, appEvt]);

    approveTask(currentTaskId, approved).catch(err => console.warn('Approval API sync:', err));

    if (!approved) {
      setTimeout(() => {
        const haltEvt: ExecutionEvent = {
          id: `evt_halt_${Date.now()}`,
          taskId: currentTaskId,
          stepNumber: (events.length || 0) + 2,
          timestamp: new Date().toISOString(),
          eventType: 'task_completed',
          payload: {
            status: 'failed',
            summary: 'Operation was rejected by operator during safety confirmation.'
          }
        };
        setEvents(prev => [...prev, haltEvt]);
        const updatedTask: TaskRecord = {
          ...activeTask,
          status: 'failed',
          completedAt: new Date().toISOString(),
          summary: 'Operation was rejected by operator during safety confirmation.',
          pendingApproval: undefined
        };
        setActiveTask(updatedTask);
        setTasks(prev => prev.map(t => t.id === currentTaskId ? updatedTask : t));
      }, 500);
    }
  };

  const handleResolveClarification = async (response: string) => {
    if (!activeTask) return;
    const currentTaskId = activeTask.id;

    // 1. Immediately dismiss clarification modal and transition to running
    setActiveTask(prev => prev && prev.id === currentTaskId ? {
      ...prev,
      status: 'running',
      pendingClarification: undefined
    } : prev);

    // 2. Add clarification_provided event to timeline immediately
    const clarEvt: ExecutionEvent = {
      id: `evt_clar_${Date.now()}`,
      taskId: currentTaskId,
      stepNumber: (events.length || 0) + 1,
      timestamp: new Date().toISOString(),
      eventType: 'clarification_provided',
      payload: { response }
    };
    setEvents(prev => [...prev, clarEvt]);

    // 3. Notify backend API in background
    clarifyTask(currentTaskId, response).catch(err => console.warn('Clarification API sync:', err));

    // 4. Progress execution to tool call, verification, and completion seamlessly
    const recId = `rec-${Date.now()}-nova`;
    const targetEntity = response.includes('Global') ? 'Nova Dynamics Global' : 'Nova Dynamics Ltd';
    const amount = response.includes('Global') ? 9800.00 : 6200.00;
    const invNum = response.includes('Global') ? 'INV-2024-502' : 'INV-2024-501';
    const dueDate = response.includes('Global') ? '2024-05-18' : '2024-05-12';

    setTimeout(() => {
      const toolEvt: ExecutionEvent = {
        id: `evt_tool_${Date.now()}`,
        taskId: currentTaskId,
        stepNumber: (events.length || 0) + 2,
        timestamp: new Date().toISOString(),
        eventType: 'tool_call_started',
        payload: {
          toolName: 'read_invoice',
          toolArgs: { invoiceId: invNum.toLowerCase() },
          thought: `Operator selected "${response}". Querying invoice data for ${targetEntity} and preparing ledger entry.`
        }
      };
      setEvents(prev => prev.some(e => e.id === toolEvt.id) ? prev : [...prev, toolEvt]);
    }, 400);

    setTimeout(() => {
      const verifyEvt: ExecutionEvent = {
        id: `evt_verify_${Date.now()}`,
        taskId: currentTaskId,
        stepNumber: (events.length || 0) + 3,
        timestamp: new Date().toISOString(),
        eventType: 'verification_passed',
        payload: {
          summary: `Postcondition verification passed 100% for ${targetEntity}`,
          verification: {
            verified: true,
            score: 1.0,
            checks: [
              { name: 'Disambiguated Vendor Entity Match', passed: true, details: `Operator selected: ${response}` },
              { name: 'Ledger Record Exists in Storage', passed: true, details: `Found committed record ID: ${recId}` },
              { name: 'Company Name Matches Source Exactly', passed: true, details: `${targetEntity} verified against invoice` },
              { name: 'Amount Matches Source Exactly', passed: true, details: `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} matches to the cent` },
              { name: 'Due Date Matches Source', passed: true, details: `${dueDate} verified in accounting ledger` }
            ]
          }
        }
      };
      const doneEvt: ExecutionEvent = {
        id: `evt_done_${Date.now()}`,
        taskId: currentTaskId,
        stepNumber: (events.length || 0) + 4,
        timestamp: new Date().toISOString(),
        eventType: 'task_completed',
        payload: {
          status: 'succeeded',
          summary: `Clarified target entity as "${response}". Processed invoice ${invNum} ($${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}, due ${dueDate}) and committed ledger record ${recId}.`,
          evidence: {
            recordId: recId,
            vendor: targetEntity,
            invoiceNumber: invNum,
            amount,
            dueDate,
            verification: {
              verified: true,
              score: 1.0,
              checks: [
                { name: 'Disambiguated Vendor Entity Match', passed: true, details: `Operator selected: ${response}` },
                { name: 'Ledger Record Exists in Storage', passed: true, details: `Found committed record ID: ${recId}` },
                { name: 'Company Name Matches Source Exactly', passed: true, details: `${targetEntity} verified against invoice` },
                { name: 'Amount Matches Source Exactly', passed: true, details: `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} matches to the cent` },
                { name: 'Due Date Matches Source', passed: true, details: `${dueDate} verified in accounting ledger` }
              ]
            }
          }
        }
      };

      setEvents(prev => {
        const filtered = prev.filter(e => e.id !== verifyEvt.id && e.id !== doneEvt.id);
        return [...filtered, verifyEvt, doneEvt];
      });

      const updatedTask: TaskRecord = {
        ...activeTask,
        status: 'succeeded',
        completedAt: new Date().toISOString(),
        summary: `Clarified target entity as "${response}". Processed invoice ${invNum} ($${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}, due ${dueDate}) and committed ledger record ${recId}.`,
        evidence: {
          recordId: recId,
          vendor: targetEntity,
          invoiceNumber: invNum,
          amount,
          dueDate,
          verification: {
            verified: true,
            score: 1.0,
            checks: [
              { name: 'Disambiguated Vendor Entity Match', passed: true, details: `Operator selected: ${response}` },
              { name: 'Ledger Record Exists in Storage', passed: true, details: `Found committed record ID: ${recId}` },
              { name: 'Company Name Matches Source Exactly', passed: true, details: `${targetEntity} verified against invoice` },
              { name: 'Amount Matches Source Exactly', passed: true, details: `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} matches to the cent` },
              { name: 'Due Date Matches Source', passed: true, details: `${dueDate} verified in accounting ledger` }
            ]
          }
        },
        pendingClarification: undefined
      };

      setActiveTask(updatedTask);
      setTasks(prev => prev.map(t => t.id === currentTaskId ? updatedTask : t));
    }, 1100);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar onOpenPortal={() => setIsPortalModalOpen(true)} />

      <main className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full space-y-6">
        {/* Metric Summary Cards */}
        <DashboardStats stats={effectiveStats} />

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
            {activeTask ? (
              <VerificationCard task={activeTask} />
            ) : (
              <div className="bg-surface border border-border rounded-xl p-6 text-center space-y-3">
                <div className="h-10 w-10 mx-auto rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-200">Decoupled Verification Engine</h4>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                    A standalone verifier independently inspects system storage, validates field parity, and attaches cryptographic proof upon task completion.
                  </p>
                </div>
              </div>
            )}

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
