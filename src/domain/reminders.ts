import type { Task } from './task.ts';

export function reminderQueue(tasks: Task[], now = Date.now()): [string, string, string, number][] {
  return tasks.filter(task => task.status !== 'done' && task.deletedAtUtc === null && task.reminderAtUtc
    && Date.parse(task.reminderAtUtc) >= now - 5 * 60_000)
    .map(task => [task.id, `${task.title} · ${new Date(task.scheduledAtUtc).toLocaleString()}`, task.reminderAtUtc!, Date.parse(task.reminderAtUtc!)]);
}
