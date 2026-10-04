import type { Task } from './task.ts';

export type TaskFilter = 'all' | 'open' | 'in_progress' | 'done' | 'unread' | 'overdue';

export function filterTasks(tasks: Task[], search: string, filter: TaskFilter, day: string, now: Date): Task[] {
  const text = search.trim().toLocaleLowerCase();
  return tasks.filter(task => {
    if (task.deletedAtUtc !== null || (text && !task.title.toLocaleLowerCase().includes(text))) return false;
    if (filter === 'open' && task.status === 'done') return false;
    if (filter === 'in_progress' && task.status !== 'in_progress') return false;
    if (filter === 'done' && task.status !== 'done') return false;
    if (filter === 'unread' && task.isRead) return false;
    if (filter === 'overdue' && (task.status === 'done' || Date.parse(task.scheduledAtUtc) >= now.getTime())) return false;
    if (day) {
      const scheduled = new Date(task.scheduledAtUtc);
      const pad = (value: number) => String(value).padStart(2, '0');
      if (`${scheduled.getFullYear()}-${pad(scheduled.getMonth() + 1)}-${pad(scheduled.getDate())}` !== day) return false;
    }
    return true;
  });
}
