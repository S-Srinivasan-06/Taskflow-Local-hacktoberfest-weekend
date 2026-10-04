import { z } from 'zod';
import { localIsoToUtc } from '../domain/dates.ts';

const localDate = z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}$/).refine(value => {
  try { localIsoToUtc(value); return true; } catch { return false; }
}, 'Invalid local date/time');
const title = z.string().min(1).max(280).refine(value => Boolean(value.trim()), 'Missing title');
const duration = z.number().int().positive().nullable().optional();

export function buildActionSchema(taskCount: number) {
  const reference = z.number().int().min(1).max(taskCount);
  return z.discriminatedUnion('action', [
    z.strictObject({ action: z.literal('create'), title, scheduled_at_local: localDate.optional(), duration_minutes: duration }),
    z.strictObject({ action: z.literal('update'), task_ref: reference, title: title.optional(), scheduled_at_local: localDate.optional(), duration_minutes: duration }).refine(
      action => action.title !== undefined || action.scheduled_at_local !== undefined || action.duration_minutes !== undefined, 'No task changes provided'),
    z.strictObject({ action: z.literal('delete'), task_ref: reference }),
    z.strictObject({ action: z.literal('set_status'), task_ref: reference, status: z.enum(['todo', 'in_progress', 'done']) }),
    z.strictObject({ action: z.literal('set_read'), task_ref: reference, is_read: z.boolean() }),
    z.strictObject({ action: z.literal('query'), kind: z.enum(['range', 'open', 'unread', 'done', 'next']), from_local: localDate.optional(), to_local: localDate.optional() }).refine(
      action => action.kind !== 'range' || Boolean(action.from_local && action.to_local && action.from_local < action.to_local), 'A range needs an ordered start and end'),
    z.strictObject({ action: z.literal('clarify'), question: z.string().min(1).max(240), task_refs: z.array(reference).max(25).optional() }),
  ]);
}

export type ModelAction = z.infer<ReturnType<typeof buildActionSchema>>;
export type QuerySpec = { kind: 'range' | 'open' | 'unread' | 'done' | 'next'; fromUtc?: string; toUtc?: string; nowUtc: string };

export function buildActionJsonSchema(taskCount: number): Record<string, unknown> {
  return z.toJSONSchema(buildActionSchema(taskCount)) as Record<string, unknown>;
}
