import type { CreateTaskInput, TaskStatus, UpdateTaskInput } from './task.ts';

export type TaskCommand =
  | { type: 'create'; payload: CreateTaskInput }
  | { type: 'update'; taskId: string; payload: UpdateTaskInput }
  | { type: 'delete'; taskId: string }
  | { type: 'set_status'; taskId: string; status: TaskStatus }
  | { type: 'set_read'; taskId: string; isRead: boolean }
  | { type: 'acknowledge_reminder'; taskId: string; reminderAtUtc: string };
