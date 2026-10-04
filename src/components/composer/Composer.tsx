import { useRef, useState } from 'react';
import { getTaskById, listTimelineTasks } from '../../db/taskRepository.ts';
import type { TaskCommand } from '../../domain/actions.ts';
import type { Interpretation, InterpretOptions } from '../../model/modelService.ts';

interface Props {
  disabled: boolean;
  modelState: 'missing' | 'stopped' | 'starting' | 'ready' | 'error';
  interpret(text: string, options: InterpretOptions): Promise<Interpretation>;
  onCommand(command: TaskCommand): Promise<boolean>;
  onUnload(): Promise<void>;
  onOpenModels(): Promise<void>;
  onRefreshModels(): Promise<void>;
}

function dateTime(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function proposalDetails(result: Extract<Interpretation, { kind: 'proposal' }>) {
  const { command, task } = result;
  const title = command.type === 'create' || command.type === 'update' ? command.payload.title ?? task?.title : task?.title;
  const when = command.type === 'create' || command.type === 'update' ? command.payload.scheduledAtUtc ?? task?.scheduledAtUtc : task?.scheduledAtUtc;
  const action = command.type === 'set_status' ? `Mark ${command.status.replace('_', ' ')}`
    : command.type === 'set_read' ? `Mark ${command.isRead ? 'read' : 'unread'}`
      : command.type === 'create' ? 'Create task' : command.type === 'update' ? 'Update task' : 'Delete task';
  const duration = command.type === 'create' || command.type === 'update' ? command.payload.durationMinutes : undefined;
  return { action, title, when, duration };
}

export function Composer({ disabled, modelState, interpret, onCommand, onUnload, onOpenModels, onRefreshModels }: Props) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<Interpretation | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const requestText = useRef('');
  const running = useRef(false);

  async function send(selectedTaskId?: string) {
    if (running.current || disabled || (!selectedTaskId && !text.trim())) return;
    running.current = true;
    setBusy(true);
    setNotice('');
    let request = selectedTaskId ? requestText.current : text.trim();
    if (!selectedTaskId && result?.kind === 'clarification' && !result.choices.length) {
      request = `${requestText.current}\nClarification: ${result.question}\nAnswer: ${request}`;
    }
    requestText.current = request;
    setResult(null);
    try {
      setResult(await interpret(request, { tasks: await listTimelineTasks(), selectedTaskId }));
      setText('');
    } catch { setNotice('Your request could not be completed. Try again.'); }
    finally { running.current = false; setBusy(false); }
  }

  async function approve() {
    if (running.current || disabled || result?.kind !== 'proposal') return;
    running.current = true;
    setBusy(true);
    try {
      if (result.task) {
        const current = await getTaskById(result.task.id);
        if (!current || current.updatedAtUtc !== result.task.updatedAtUtc) {
          setResult(null);
          setNotice('That task changed. Please send your request again.');
          return;
        }
      }
      if (await onCommand(result.command)) { setResult(null); setNotice('Saved locally.'); }
    } catch { setNotice('That change could not be saved. Try again.'); }
    finally { running.current = false; setBusy(false); }
  }

  async function manageModel(action: () => Promise<void>) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try { await action(); }
    catch { setNotice('That action could not be completed. Try again.'); }
    finally { running.current = false; setBusy(false); }
  }

  const proposal = result?.kind === 'proposal' ? proposalDetails(result) : null;
  const status = modelState === 'missing' ? 'Local model not found' : modelState === 'starting' ? 'Starting…'
    : modelState === 'ready' ? 'Ready · Works offline' : modelState === 'error' ? 'Could not start. Try again.' : 'Starts when you send a request';

  return <section className="composer" aria-label="Task requests">
    <div className="composer-status"><span role="status">{status}</span>
      {modelState === 'ready' ? <button type="button" disabled={busy} onClick={() => { void manageModel(onUnload); }}>Unload</button> : null}
      {modelState === 'missing' ? <><button type="button" disabled={busy} onClick={() => { void manageModel(onOpenModels); }}>Open Models Folder</button>
        <button type="button" disabled={busy} onClick={() => { void manageModel(onRefreshModels); }}>Check for model</button></> : null}
    </div>
    <div className="request-result" aria-live="polite">
      {proposal ? <div className="approval surface">
        <strong>{proposal.action}: {proposal.title}</strong>
        {proposal.when ? <p>{dateTime(proposal.when)}</p> : null}
        {result?.kind === 'proposal' && result.command.type === 'update' && result.task ? <p className="muted">Was: {result.task.title} · {dateTime(result.task.scheduledAtUtc)}</p> : null}
        {proposal.duration !== undefined ? <p>{proposal.duration === null ? 'No duration' : `${proposal.duration} minutes`}</p> : null}
        <p className="muted">Nothing changes until you approve it.</p>
        <div className="request-actions"><button className="primary" type="button" disabled={busy || disabled} onClick={() => { void approve(); }}>Approve</button>
          <button type="button" disabled={busy} onClick={() => setResult(null)}>Cancel</button></div>
      </div> : null}
      {result?.kind === 'clarification' ? <div className="approval surface"><strong>{result.question}</strong>
        <div className="request-actions">{result.choices.map(task => <button type="button" key={task.id} disabled={busy || disabled} onClick={() => { void send(task.id); }}>{task.title} · {dateTime(task.scheduledAtUtc)}</button>)}
          <button type="button" disabled={busy} onClick={() => setResult(null)}>Cancel</button></div>
      </div> : null}
      {result?.kind === 'query' ? <div className="approval surface"><strong>{result.tasks.length ? 'Your tasks' : 'No tasks match.'}</strong>
        <ul>{result.tasks.map(task => <li key={task.id}>{task.title} · {dateTime(task.scheduledAtUtc)} · {task.status.replace('_', ' ')}</li>)}</ul>
        <button type="button" onClick={() => setResult(null)}>Dismiss</button></div> : null}
      {result?.kind === 'error' ? <p role="alert">{result.message}</p> : null}
      {notice ? <p role="status">{notice}</p> : null}
    </div>
    <form className="composer-input" onSubmit={event => { event.preventDefault(); void send(); }}>
      <label className="sr-only" htmlFor="task-request">Tell Taskflow something</label>
      <input id="task-request" value={text} maxLength={1500} placeholder="Tell Taskflow something…" disabled={busy || disabled}
        onChange={event => setText(event.target.value)} />
      <button type="submit" className="primary" disabled={busy || disabled || !text.trim()}>{busy ? modelState === 'starting' ? 'Starting…' : 'Working…' : 'Send'}</button>
    </form>
  </section>;
}
