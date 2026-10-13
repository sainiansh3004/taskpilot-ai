import type { TaskRecord, ExecutionEvent, DashboardStats } from '../types';

export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || '/api').replace(/\/$/, '');

export const PORTAL_BASE = (process.env.NEXT_PUBLIC_PORTAL_URL || '/api/portal').replace(/\/$/, '');

const SCREENSHOT_BASE = process.env.NEXT_PUBLIC_API_URL
  ? API_BASE.replace(/\/api$/, '')
  : '';

export function getScreenshotUrl(relativePath: string): string {
  if (!relativePath) return '';
  const cleanPath = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  if (SCREENSHOT_BASE) {
    return `${SCREENSHOT_BASE}${cleanPath}`;
  }
  return cleanPath;
}

export async function fetchStats(): Promise<DashboardStats> {
  const res = await fetch(`${API_BASE}/stats`);
  if (!res.ok) throw new Error('Failed to fetch stats');
  const data = await res.json();
  return data.stats;
}

export async function fetchTasks(status?: string): Promise<TaskRecord[]> {
  const url = status ? `${API_BASE}/tasks?status=${encodeURIComponent(status)}` : `${API_BASE}/tasks`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch tasks');
  const data = await res.json();
  return data.tasks;
}

export async function fetchTask(taskId: string): Promise<TaskRecord> {
  const res = await fetch(`${API_BASE}/tasks/${encodeURIComponent(taskId)}`);
  if (!res.ok) throw new Error('Failed to fetch task');
  const data = await res.json();
  return data.task;
}

export async function fetchTaskEvents(taskId: string): Promise<ExecutionEvent[]> {
  const res = await fetch(`${API_BASE}/tasks/${encodeURIComponent(taskId)}/events`);
  if (!res.ok) throw new Error('Failed to fetch task events');
  const data = await res.json();
  return data.events;
}

export async function createTask(goal: string): Promise<TaskRecord> {
  const res = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to submit task');
  }
  const data = await res.json();
  return data.task;
}

export async function cancelTask(taskId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/tasks/${encodeURIComponent(taskId)}/cancel`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to cancel task');
}

export async function clearAllTasks(): Promise<void> {
  try {
    await fetch(`${API_BASE}/tasks`, { method: 'DELETE' });
  } catch {}
}

export async function approveTask(taskId: string, approved: boolean): Promise<void> {
  const res = await fetch(`${API_BASE}/tasks/${encodeURIComponent(taskId)}/approval`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approved })
  });
  if (res.status === 404) {
    const resAlt = await fetch(`${API_BASE}/tasks/${encodeURIComponent(taskId)}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved })
    });
    if (!resAlt.ok) throw new Error('Failed to send approval decision');
    return;
  }
  if (!res.ok) throw new Error('Failed to send approval decision');
}

export async function clarifyTask(taskId: string, response: string): Promise<void> {
  const res = await fetch(`${API_BASE}/tasks/${encodeURIComponent(taskId)}/clarify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ response })
  });
  if (!res.ok) throw new Error('Failed to send clarification');
}

export async function fetchPortalInvoices(): Promise<any[]> {
  const isInternal = PORTAL_BASE.includes('/api/portal');
  const url = isInternal ? `${PORTAL_BASE}/invoices` : `${PORTAL_BASE}/api/invoices`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return data.invoices || [];
}

export async function fetchPortalRecords(): Promise<any[]> {
  const isInternal = PORTAL_BASE.includes('/api/portal');
  const url = isInternal ? `${PORTAL_BASE}/records` : `${PORTAL_BASE}/api/records`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return data.records || [];
}
