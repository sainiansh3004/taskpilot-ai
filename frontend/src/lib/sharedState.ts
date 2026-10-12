import type { ExecutionEvent, TaskRecord } from '../types';

const redisUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const hasSharedState = Boolean(redisUrl && redisToken);

async function redisCommand<T>(...command: string[]): Promise<T> {
  if (!redisUrl || !redisToken) {
    throw new Error('Shared task storage is not configured.');
  }

  const response = await fetch(redisUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${redisToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(command),
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`Shared task storage request failed (${response.status}).`);
  }

  const result = await response.json() as { result?: T; error?: string };
  if (result.error) {
    throw new Error(`Shared task storage rejected ${command[0]}: ${result.error}`);
  }
  return result.result as T;
}

const taskKey = (id: string) => `taskpilot:task:${id}`;
const eventsKey = (id: string) => `taskpilot:events:${id}`;
const redisBaseUrl = redisUrl?.replace(/\/$/, '');

export async function saveSharedTask(task: TaskRecord): Promise<void> {
  await redisPipeline([
    ['SET', taskKey(task.id), JSON.stringify(task)],
    ['SADD', 'taskpilot:task-ids', task.id]
  ]);
}

export async function getSharedTask(id: string): Promise<TaskRecord | undefined> {
  const value = await redisCommand<string | null>('GET', taskKey(id));
  return value ? JSON.parse(value) as TaskRecord : undefined;
}

export async function getSharedTasks(): Promise<TaskRecord[]> {
  const ids = await redisCommand<string[]>('SMEMBERS', 'taskpilot:task-ids');
  if (ids.length === 0) return [];
  const values = await redisCommand<Array<string | null>>('MGET', ...ids.map(taskKey));
  return values
    .filter((value): value is string => value !== null)
    .map(value => JSON.parse(value) as TaskRecord)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export async function persistSharedEvent(
  task: TaskRecord,
  event: ExecutionEvent,
  records: unknown[]
): Promise<void> {
  await redisPipeline([
    ['SET', taskKey(task.id), JSON.stringify(task)],
    ['SADD', 'taskpilot:task-ids', task.id],
    ['RPUSH', eventsKey(event.taskId), JSON.stringify(event)],
    ['SET', 'taskpilot:portal-records', JSON.stringify(records)]
  ]);
}

export async function getSharedEvents(taskId: string): Promise<ExecutionEvent[]> {
  const values = await redisCommand<string[]>('LRANGE', eventsKey(taskId), '0', '-1');
  return values.map(value => JSON.parse(value) as ExecutionEvent);
}

export async function getSharedPortalRecords<T>(): Promise<T[] | undefined> {
  const value = await redisCommand<string | null>('GET', 'taskpilot:portal-records');
  return value ? JSON.parse(value) as T[] : undefined;
}

async function redisPipeline(commands: string[][]): Promise<void> {
  if (!redisBaseUrl || !redisToken) {
    throw new Error('Shared task storage is not configured.');
  }

  const response = await fetch(`${redisBaseUrl}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${redisToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(commands),
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`Shared task storage pipeline failed (${response.status}).`);
  }

  const results = await response.json() as Array<{ error?: string }>;
  const failed = results.find(result => result.error);
  if (failed?.error) {
    throw new Error(`Shared task storage pipeline rejected a command: ${failed.error}`);
  }
}
