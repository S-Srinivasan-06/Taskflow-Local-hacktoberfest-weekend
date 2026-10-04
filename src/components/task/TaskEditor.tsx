import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { localIsoToUtc, toLocalIsoWithoutOffset } from '../../domain/dates.ts';
import type { TaskCommand } from '../../domain/actions.ts';
import type { Task } from '../../domain/task.ts';
import { enableReminders } from '../../state/useReminders.ts';

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
  const originalReminder = task?.reminderAtUtc
    ? String(Math.max(0, Math.round((Date.parse(task.scheduledAtUtc) - Date.parse(task.reminderAtUtc)) / 60_000))) : 'none';
  const [reminder, setReminder] = useState(originalReminder);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      if (!title.trim()) throw new Error('Enter a task title.');
      const localTime = scheduledAt.length === 16 ? `${scheduledAt}:00` : scheduledAt;
      const scheduledAtUtc = localIsoToUtc(localTime);
      const durationMinutes = duration === '' ? null : Number(duration);
      if (durationMinutes !== null && (!Number.isSafeInteger(durationMinutes) || durationMinutes <= 0)) {
        throw new Error('Duration must be a positive whole number of minutes.');
      }
      const reminderAtUtc = reminder === 'none' ? null
        : new Date(Date.parse(scheduledAtUtc) - Number(reminder) * 60_000).toISOString();
      if (reminderAtUtc && (!task || reminder !== originalReminder || scheduledAtUtc !== task.scheduledAtUtc)) {
        if (Date.parse(reminderAtUtc) <= Date.now() && reminderAtUtc !== task?.reminderAtUtc) throw new Error('Choose a future reminder time.');
        await enableReminders();
      }
      // The editor may have been closed while Windows was asking for permission.
      if (!mounted.current) return;
      const payload = { title: title.trim(), durationMinutes,
        ...(!task || reminder !== originalReminder ? { reminderAtUtc } : {}) };
      // An unchanged reminder is read from SQLite by the service, so an old editor cannot re-arm a fired reminder.
      const command: TaskCommand = task
        ? { type: 'update', taskId: task.id, payload: { ...payload,
          ...(scheduledAtUtc !== task.scheduledAtUtc ? { scheduledAtUtc } : {}) } }
        : { type: 'create', payload: { ...payload, scheduledAtUtc } };
      if (await onSave(command) && mounted.current) onClose();
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'Check the title, date, and duration.');
    } finally {
      submittingRef.current = false;
      if (mounted.current) setSubmitting(false);
    }
  }

  return (
    <section className="editor surface" aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`}>{task ? 'Edit task' : 'New task'}</h2>
      <form onSubmit={(event) => { void submit(event); }}>
        <fieldset disabled={saving || submitting}>
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
          <div className="editor-reminder">
            <label htmlFor={`${id}-reminder`}>Desktop reminder</label>
            <select id={`${id}-reminder`} value={reminder} onChange={event => setReminder(event.target.value)}>
              <option value="none">None</option>
              {[0, 5, 15, 30, 60].map(minutes => <option key={minutes} value={minutes}>{minutes ? `${minutes} minutes before` : 'At task time'}</option>)}
              {reminder !== 'none' && ![0, 5, 15, 30, 60].includes(Number(reminder)) ? <option value={reminder}>{reminder} minutes before</option> : null}
            </select>
          </div>
          {error ? <p role="alert" className="error-text">{error}</p> : null}
          <div className="editor-actions">
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary">{saving || submitting ? 'Saving…' : task ? 'Save changes' : 'Add task'}</button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
