export const TASK_STATUSES = ['todo', 'in_progress', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface Task {
  id: string;
  title: string;
  scheduledAtUtc: string;
  durationMinutes: number | null;
  status: TaskStatus;
  isRead: boolean;
  reminderAtUtc: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
  deletedAtUtc: string | null;
}

export interface CreateTaskInput {
  title: string;
  scheduledAtUtc: string;
  durationMinutes?: number | null;
}

export interface UpdateTaskInput {
  title?: string;
  scheduledAtUtc?: string;
  durationMinutes?: number | null;
}
