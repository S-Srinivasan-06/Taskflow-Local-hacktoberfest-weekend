import type { TaskCommand } from '../domain/actions.ts';
import { localIsoToUtc } from '../domain/dates.ts';
import type { Task, UpdateTaskInput } from '../domain/task.ts';
import { buildActionJsonSchema, buildActionSchema } from './actionSchema.ts';
import type { ModelAction, QuerySpec } from './actionSchema.ts';
import { buildContext } from './context.ts';
import type { LlamaClient } from './llamaClient.ts';
import { buildPrompt } from './prompt.ts';

export type Interpretation =
  | { kind: 'proposal'; command: TaskCommand; task?: Task }
  | { kind: 'query'; tasks: Task[] }
  | { kind: 'clarification'; question: string; choices: Task[] }
  | { kind: 'error'; message: string };
export interface InterpretOptions { tasks: Task[]; now?: Date; selectedTaskId?: string; image?: string }
export const SAFE_INTERPRETATION_ERROR = "I couldn't interpret that safely. Try saying it another way.";

function toCommand(action: Exclude<ModelAction, { action: 'query' | 'clarify' }>, task?: Task): TaskCommand | null {
  if (action.action === 'create') {
    return action.scheduled_at_local ? { type: 'create', payload: { title: action.title.trim(),
      scheduledAtUtc: localIsoToUtc(action.scheduled_at_local), durationMinutes: action.duration_minutes } } : null;
  }
  if (!task) throw new Error('Unknown task reference');
  switch (action.action) {
    case 'update': {
      const payload: UpdateTaskInput = {};
      if (action.title !== undefined) payload.title = action.title.trim();
      if (action.scheduled_at_local !== undefined) payload.scheduledAtUtc = localIsoToUtc(action.scheduled_at_local);
      if (action.duration_minutes !== undefined) payload.durationMinutes = action.duration_minutes;
      return { type: 'update', taskId: task.id, payload };
    }
    case 'delete': return { type: 'delete', taskId: task.id };
    case 'set_status': return { type: 'set_status', taskId: task.id, status: action.status };
    case 'set_read': return { type: 'set_read', taskId: task.id, isRead: action.is_read };
  }
}

export function createModelService(dependencies: { client: LlamaClient; queryTasks(query: QuerySpec): Promise<Task[]> }) {
  let busy = false;
  return {
    get busy() { return busy; },
    async interpretUserRequest(text: string, options: InterpretOptions): Promise<Interpretation> {
      if (busy) return { kind: 'error', message: 'A request is already running.' };
      if (!text.trim()) return { kind: 'clarification', question: 'What would you like to do?', choices: [] };
      if (options.image && (!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(options.image) || options.image.length > 7_000_000)) {
        return { kind: 'error', message: 'Choose a PNG or JPEG image smaller than 5 MB.' };
      }
      busy = true;
      try {
        const context = buildContext(options.tasks, options.now, options.selectedTaskId);
        if (options.selectedTaskId && !context.tasks.length) return { kind: 'error', message: 'Task not found.' };
        // Rough prompt budget: three characters per token. Remove distant tasks first.
        let prompt = buildPrompt(context);
        const promptBudget = options.image ? 5500 : 9000;
        while (context.tasks.length && prompt.length + text.length > promptBudget) {
          const farthest = context.tasks.reduce((index, task, candidate) =>
            Math.abs(Date.parse(task.scheduledAtUtc) - context.now.getTime()) >
            Math.abs(Date.parse(context.tasks[index].scheduledAtUtc) - context.now.getTime()) ? candidate : index, 0);
          context.tasks.splice(farthest, 1);
          prompt = buildPrompt(context);
        }
        if (prompt.length + text.length > promptBudget) return { kind: 'error', message: 'Please use a shorter request.' };
        if (options.selectedTaskId && !context.tasks.length) return { kind: 'error', message: 'That task is too long for a language request. Use Edit instead.' };
        const schema = buildActionSchema(context.tasks.length);
        let action: ModelAction | undefined;
        for (let attempt = 0; attempt < 2; attempt++) {
          const content = await dependencies.client.complete({
            messages: [{ role: 'system', content: prompt }, { role: 'user', content: text + (attempt ? '\nReturn a valid action using only the listed task numbers and real local dates. Include all required fields.' : ''), ...(options.image ? { image: options.image } : {}) }],
            response_format: { type: 'json_schema', json_schema: { name: 'taskflow_action', strict: true, schema: buildActionJsonSchema(context.tasks.length) } },
            chat_template_kwargs: { enable_thinking: false }, temperature: 0, max_tokens: 256,
          });
          try { action = schema.parse(JSON.parse(content)); break; } catch { /* Retry invalid JSON or action once. */ }
        }
        if (!action) return { kind: 'error', message: SAFE_INTERPRETATION_ERROR };
        if (action.action === 'clarify') return { kind: 'clarification', question: action.question,
          choices: [...new Set(action.task_refs ?? [])].map(reference => context.tasks[reference - 1]) };
        if (action.action === 'query') {
          const tasks = await dependencies.queryTasks({ kind: action.kind, nowUtc: context.now.toISOString(),
            fromUtc: action.from_local ? localIsoToUtc(action.from_local) : undefined,
            toUtc: action.to_local ? localIsoToUtc(action.to_local) : undefined });
          return { kind: 'query', tasks };
        }
        const task = 'task_ref' in action ? context.tasks[action.task_ref - 1] : undefined;
        if (task && !options.selectedTaskId) {
          const normalized = task.title.trim().toLocaleLowerCase();
          const matches = options.tasks.filter(candidate => candidate.deletedAtUtc === null &&
            (candidate.title.trim().toLocaleLowerCase().includes(normalized) || normalized.includes(candidate.title.trim().toLocaleLowerCase())));
          if (matches.length > 1) return { kind: 'clarification', question: 'Which task?', choices: matches };
        }
        const command = toCommand(action, task);
        return command ? { kind: 'proposal', command, task } : { kind: 'clarification', question: 'When?', choices: [] };
      } catch {
        return { kind: 'error', message: SAFE_INTERPRETATION_ERROR };
      } finally { busy = false; }
    },
  };
}
