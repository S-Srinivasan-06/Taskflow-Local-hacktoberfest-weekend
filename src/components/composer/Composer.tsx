import { useRef, useState } from 'react';
import { getTaskById, listTimelineTasks } from '../../db/taskRepository.ts';
import type { TaskCommand } from '../../domain/actions.ts';
import type { Interpretation, InterpretOptions } from '../../model/modelService.ts';
import type { ChangeEvent } from 'react';

interface Props {
  disabled: boolean;
  modelState: 'missing' | 'stopped' | 'starting' | 'ready' | 'error';
  modelError?: string;
  imageCapable?: boolean;
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
  let reminder = command.type === 'create' || command.type === 'update' ? command.payload.reminderAtUtc : undefined;
  if (command.type === 'update' && reminder === undefined && task?.reminderAtUtc && command.payload.scheduledAtUtc) {
    reminder = new Date(Date.parse(command.payload.scheduledAtUtc)
      - (Date.parse(task.scheduledAtUtc) - Date.parse(task.reminderAtUtc))).toISOString();
  }
  return { action, title, when, duration, reminder };
}

export function Composer({ disabled, modelState, modelError, imageCapable, interpret, onCommand, onUnload, onOpenModels, onRefreshModels }: Props) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<Interpretation | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const requestText = useRef('');
  const running = useRef(false);
  const [image, setImage] = useState<{ name: string; data: string } | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const requestImage = useRef<string | undefined>(undefined);

  async function attachImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || running.current || disabled) return;
    if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setNotice('Choose a PNG or JPEG image smaller than 5 MB.'); return;
    }
    running.current = true;
    setBusy(true);
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Could not read image'));
        reader.readAsDataURL(file);
      });
      setImage({ name: file.name, data }); setNotice('');
    } catch { setNotice('Could not read that image.'); }
    finally { running.current = false; setBusy(false); }
  }

  async function send(selectedTaskId?: string) {
    if (running.current || disabled || (!selectedTaskId && !text.trim() && !image)) return;
    running.current = true;
    setBusy(true);
    setNotice('');
    let request = selectedTaskId ? requestText.current : text.trim() || 'Create a task from the attached screenshot. Ask for a time if it is missing.';
    const continuing = !image && Boolean(selectedTaskId || result?.kind === 'clarification');
    if (!continuing) requestImage.current = image?.data;
    if (!selectedTaskId && continuing && result?.kind === 'clarification') {
      request = `${requestText.current}\nClarification: ${result.question}\nAnswer: ${request}`;
    }
    requestText.current = request;
    setResult(null);
    try {
      const response = await interpret(request, { tasks: await listTimelineTasks(), selectedTaskId, image: requestImage.current });
      setResult(response);
      if (response.kind === 'error') {
        setText(request);
        if (requestImage.current) setImage({ name: image?.name ?? 'Screenshot', data: requestImage.current });
      } else { setText(''); setImage(null); }
    } catch {
      setText(request);
      if (requestImage.current) setImage({ name: image?.name ?? 'Screenshot', data: requestImage.current });
      setNotice('Your request could not be completed. Try again.');
    }
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
  const status = modelState === 'missing' ? 'Model not found' : modelState === 'starting' ? 'Starting…'
    : modelState === 'ready' ? 'Ready' : modelState === 'error' ? modelError || 'Could not start. Try again.' : 'Model idle';

  return <section className="composer" aria-label="Task requests">
    <div className="composer-status"><span role="status">{status}</span>
      {modelState === 'ready' || modelState === 'error' ? <button type="button" disabled={busy} onClick={() => { void manageModel(onUnload); }}>Unload</button> : null}
      {modelState === 'missing' ? <><button type="button" disabled={busy} onClick={() => { void manageModel(onOpenModels); }}>Open Models Folder</button>
        <button type="button" disabled={busy} onClick={() => { void manageModel(onRefreshModels); }}>Check for model</button></> : null}
    </div>
    <div className="request-result" aria-live="polite">
      {modelError && modelState !== 'error' ? <p className="error-text">{modelError}</p> : null}
      {proposal ? <div className="approval surface">
        <strong>{proposal.action}: {proposal.title}</strong>
        {proposal.when ? <p>{dateTime(proposal.when)}</p> : null}
        {result?.kind === 'proposal' && result.command.type === 'update' && result.task ? <p className="muted">Was: {result.task.title} · {dateTime(result.task.scheduledAtUtc)}</p> : null}
        {proposal.duration !== undefined ? <p>{proposal.duration === null ? 'No duration' : `${proposal.duration} minutes`}</p> : null}
        {proposal.reminder ? <p>Reminder: {dateTime(proposal.reminder)}</p> : null}
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
    {image ? <div className="image-attachment"><img src={image.data} alt="Selected screenshot" /><span>{image.name}</span>
      <button type="button" disabled={busy} onClick={() => setImage(null)}>Remove image</button></div> : null}
    <form className="composer-input" onSubmit={event => { event.preventDefault(); void send(); }}>
      <input ref={imageInput} className="sr-only" type="file" accept="image/png,image/jpeg" aria-label="Choose screenshot"
        onChange={event => { void attachImage(event); }} disabled={busy || disabled || !imageCapable} />
      <button type="button" disabled={busy || disabled} aria-label="Attach screenshot" title="Attach screenshot" onClick={() => {
        if (!imageCapable) setNotice('Choose an image-capable model and its matching projector in Settings.');
        else imageInput.current?.click();
      }}>Image</button>
      <label className="sr-only" htmlFor="task-request">Tell Taskflow something</label>
      <input id="task-request" value={text} maxLength={1500} placeholder="Tell Taskflow something…" disabled={busy || disabled}
        onChange={event => setText(event.target.value)} />
      <button type="submit" className="primary" disabled={busy || disabled || (!text.trim() && !image)}>{busy ? modelState === 'starting' ? 'Starting…' : 'Working…' : 'Send'}</button>
    </form>
  </section>;
}
