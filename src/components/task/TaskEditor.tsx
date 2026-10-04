import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { localIsoToUtc, toLocalIsoWithoutOffset } from '../../domain/dates.ts';
import type { TaskCommand } from '../../domain/actions.ts';
import type { Task } from '../../domain/task.ts';

interface TaskEditorProps {
  task: Task | null;
  saving: boolean;
  onSave: (command: TaskCommand) => Promise<boolean>;
  onClose: () => void;
}

function initialTime(task: Task | null): string {
  const date = task ? new Date(task.scheduledAtUtc) : new Date();
  if (!task) date.setMinutes(date.getMinutes() + 30, 0, 0);
  return toLocalIsoWithoutOffset(date);
}

export function TaskEditor({ task, saving, onSave, onClose }: TaskEditorProps) {
  const id = useId();
  const [title, setTitle] = useState(task?.title ?? '');
  const [scheduledAt, setScheduledAt] = useState(() => initialTime(task));
  const [duration, setDuration] = useState(task?.durationMinutes?.toString() ?? '');
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setError(null);
    let command: TaskCommand;
    try {
      if (!title.trim()) throw new Error('Enter a task title.');
      const localTime = scheduledAt.length === 16 ? `${scheduledAt}:00` : scheduledAt;
      const scheduledAtUtc = localIsoToUtc(localTime);
      const durationMinutes = duration === '' ? null : Number(duration);
      if (durationMinutes !== null && (!Number.isSafeInteger(durationMinutes) || durationMinutes <= 0)) {
        throw new Error('Duration must be a positive whole number of minutes.');
      }
      const payload = { title: title.trim(), scheduledAtUtc, durationMinutes };
      command = task ? { type: 'update', taskId: task.id, payload } : { type: 'create', payload };
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Check the title, date, and duration.');
      return;
    }
    if (await onSave(command)) onClose();
  }

  return (
    <section className="editor surface" aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`}>{task ? 'Edit task' : 'New task'}</h2>
      <form onSubmit={(event) => { void submit(event); }}>
        <fieldset disabled={saving}>
          <label htmlFor={`${id}-title`}>Task</label>
          <input id={`${id}-title`} value={title} onChange={(event) => setTitle(event.target.value)}
            placeholder="What needs doing?" required autoFocus />
          <div className="editor-dates">
            <div>
              <label htmlFor={`${id}-time`}>Date and time</label>
              <input id={`${id}-time`} type="datetime-local" step="1" required
                value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />
            </div>
            <div>
              <label htmlFor={`${id}-duration`}>Duration (minutes)</label>
              <input id={`${id}-duration`} type="number" min="1" step="1" value={duration}
                onChange={(event) => setDuration(event.target.value)} placeholder="Optional" />
            </div>
          </div>
          <p className="muted editor-hint">Times use your computer’s local timezone.</p>
          {error ? <p role="alert" className="error-text">{error}</p> : null}
          <div className="editor-actions">
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary">{saving ? 'Saving…' : task ? 'Save changes' : 'Add task'}</button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
