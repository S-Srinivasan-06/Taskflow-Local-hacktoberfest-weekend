import { useId, useState } from 'react';
import type { Task, TaskStatus } from '../../domain/task.ts';
import type { TaskCommand } from '../../domain/actions.ts';

const clock = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });

interface TimelineTaskProps {
  task: Task;
  next: boolean;
  disabled: boolean;
  onEdit: (task: Task) => void;
  onCommand: (command: TaskCommand) => Promise<boolean>;
}

export function TimelineTask({ task, next, disabled, onEdit, onCommand }: TimelineTaskProps) {
  const id = useId();
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function remove() {
    if (await onCommand({ type: 'delete', taskId: task.id })) setConfirmDelete(false);
  }

  return (
    <article className="task-row surface" data-task-id={task.id} data-next={next}
      data-status={task.status} aria-labelledby={`${id}-title`}>
      <div className="task-time">
        <time dateTime={task.scheduledAtUtc}>{clock.format(new Date(task.scheduledAtUtc))}</time>
        {next ? <span className="next-label">NEXT</span> : null}
      </div>
      <div className="task-body">
        <h3 id={`${id}-title`} className="task-title" data-read={task.isRead}>{task.title}</h3>
        {task.durationMinutes !== null ? <p className="duration muted">{task.durationMinutes} min</p> : null}
        {task.reminderAtUtc ? <span className="reminder-label" title={`Reminder: ${new Date(task.reminderAtUtc).toLocaleString()}`}>Reminder</span> : null}
        <div className="task-controls">
          <label className="sr-only" htmlFor={`${id}-status`}>Status for {task.title}</label>
          <select id={`${id}-status`} aria-label={`Status for ${task.title}`} value={task.status} disabled={disabled}
            onChange={(event) => { void onCommand({ type: 'set_status', taskId: task.id, status: event.target.value as TaskStatus }); }}>
            <option value="todo">To do</option>
            <option value="in_progress">In progress</option>
            <option value="done">Done</option>
          </select>
          <button type="button" disabled={disabled} onClick={() => onEdit(task)}>Edit</button>
          <button type="button" disabled={disabled} aria-label={`Mark ${task.title} ${task.isRead ? 'unread' : 'read'}`}
            onClick={() => { void onCommand({ type: 'set_read', taskId: task.id, isRead: !task.isRead }); }}>
            {task.isRead ? 'Unread' : 'Read'}
          </button>
          <button type="button" className="danger-text" disabled={disabled} onClick={() => setConfirmDelete(true)}>Delete</button>
        </div>
        {confirmDelete ? (
          <div className="delete-confirm" role="group" aria-label={`Confirm deleting ${task.title}`}>
            <p>Delete this task?</p>
            <button type="button" disabled={disabled} onClick={() => setConfirmDelete(false)}>Keep task</button>
            <button type="button" className="danger" disabled={disabled} onClick={() => { void remove(); }}>Delete task</button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
