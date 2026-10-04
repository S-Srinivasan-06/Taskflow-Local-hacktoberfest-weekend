import { toLocalIsoWithoutOffset } from '../domain/dates.ts';
import type { Task } from '../domain/task.ts';

export interface ModelContext { tasks: Task[]; now: Date }

export function buildContext(tasks: Task[], now = new Date(), selectedTaskId?: string): ModelContext {
  const active = tasks.filter(task => task.deletedAtUtc === null && (!selectedTaskId || task.id === selectedTaskId));
  const nearby = [...active].sort((a, b) => Math.abs(Date.parse(a.scheduledAtUtc) - now.getTime()) - Math.abs(Date.parse(b.scheduledAtUtc) - now.getTime()))
    .slice(0, 25).sort((a, b) => a.scheduledAtUtc.localeCompare(b.scheduledAtUtc));
  return { tasks: nearby, now };
}

export function dateTable(now: Date): string {
  const formatter = new Intl.DateTimeFormat('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  return Array.from({ length: 14 }, (_, index) => {
    const day = new Date(now);
    day.setHours(12, 0, 0, 0);
    day.setDate(day.getDate() + index);
    return `${toLocalIsoWithoutOffset(day).slice(0, 10)} = ${formatter.format(day)}`;
  }).join('\n');
}

export function taskList(tasks: Task[]): string {
  return tasks.map((task, index) => JSON.stringify({ task_ref: index + 1, title: task.title,
    scheduled_at_local: toLocalIsoWithoutOffset(new Date(task.scheduledAtUtc)), status: task.status,
    is_read: task.isRead, duration_minutes: task.durationMinutes })).join('\n') || '(No tasks)';
}
