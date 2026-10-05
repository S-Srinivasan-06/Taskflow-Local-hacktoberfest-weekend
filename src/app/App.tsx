import { useEffect, useRef, useState } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { Timeline } from '../components/timeline/Timeline.tsx';
import { TaskEditor } from '../components/task/TaskEditor.tsx';
import { useTaskflow } from '../state/useTaskflow.ts';
import type { Task } from '../domain/task.ts';
import { Composer } from '../components/composer/Composer.tsx';
import { getModelStatus, interpretUserRequest, openModelsFolder, refreshModelAvailability, subscribeModelStatus, unloadModel } from '../model/desktopModel.ts';
import type { ModelStatus } from '../model/desktopModel.ts';
import { Settings } from '../components/common/Settings.tsx';
import { initialTheme, writePreference } from '../state/preferences.ts';
import { filterTasks } from '../domain/taskFilters.ts';
import type { TaskFilter } from '../domain/taskFilters.ts';
import { useReminders } from '../state/useReminders.ts';

export function App() {
  const { tasks, loading, ready, loaded, saving, error, reload, runCommand } = useTaskflow();
  const [editor, setEditor] = useState<{ task: Task | null } | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [modelStatus, setModelStatus] = useState<ModelStatus>(getModelStatus().status);
  const [modelDetails, setModelDetails] = useState(getModelStatus);
  const [settings, setSettings] = useState(false);
  const [theme, setTheme] = useState(initialTheme);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [day, setDay] = useState('');
  const searchInput = useRef<HTMLInputElement>(null);
  const reminderError = useReminders(tasks, ready, reload);
  const newTaskButton = useRef<HTMLButtonElement>(null);
  const editorTrigger = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => subscribeModelStatus(() => { setModelStatus(getModelStatus().status); setModelDetails(getModelStatus()); }), []);
  useEffect(() => { if (isTauri()) void refreshModelAvailability(); }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    writePreference('theme', theme);
  }, [theme]);

  function openEditor(task: Task | null) {
    editorTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEditor({ task });
  }

  function closeEditor() {
    setEditor(null);
    window.requestAnimationFrame(() => {
      const trigger = editorTrigger.current;
      if (trigger?.isConnected) trigger.focus();
      else newTaskButton.current?.focus();
    });
  }

  const disabled = !ready || loading || saving || editor !== null;
  const remaining = tasks.filter((task) => task.status !== 'done').length;
  const visibleTasks = filterTasks(tasks, search, filter, day, now);
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === 'Escape') {
        if (editor && !saving) closeEditor();
        else if (settings) setSettings(false);
        else { setSearch(''); setDay(''); setFilter('all'); }
        return;
      }
      if (event.target instanceof HTMLElement && (event.target.closest('input, textarea, select') || event.target.isContentEditable)) return;
      if (event.key === '/') { event.preventDefault(); searchInput.current?.focus(); }
      else if ((event.key.toLowerCase() === 'n' || event.key.toLowerCase() === 'c') && !disabled) {
        event.preventDefault(); openEditor(null);
      }
    }
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, [disabled, editor, saving, settings]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>TASKFLOW <span>LOCAL</span></h1>
        <div className="header-actions"><span role="status">{saving ? 'Saving…' : `${remaining} open`}</span>
          {isTauri() ? <button type="button" disabled={disabled} onClick={() => document.getElementById('task-request')?.focus()}>Chat</button> : null}
          <button type="button" onClick={() => {
            setSettings(value => !value);
            if (!settings) document.querySelector('.task-workspace')?.scrollTo({ top: 0 });
          }} aria-expanded={settings}>Settings</button>
          <button type="button" className="primary" ref={newTaskButton} disabled={disabled} onClick={() => openEditor(null)}>+ New task</button></div>
      </header>
      <main className="task-workspace" aria-label="Tasks and settings">
      {settings ? <Settings theme={theme} onTheme={setTheme} onClose={() => setSettings(false)} /> : null}
      <div className="task-filters" aria-label="Filter tasks">
        <input ref={searchInput} aria-label="Search tasks" placeholder="Search tasks…" value={search} onChange={event => setSearch(event.target.value)} />
        <select aria-label="Task filter" value={filter} onChange={event => setFilter(event.target.value as TaskFilter)}>
          <option value="all">All tasks</option><option value="open">Open</option><option value="in_progress">In progress</option>
          <option value="done">Done</option><option value="unread">Unread</option><option value="overdue">Overdue</option>
        </select>
        <input type="date" aria-label="Filter by date" value={day} onChange={event => setDay(event.target.value)} />
        {search || filter !== 'all' || day ? <button type="button" onClick={() => { setSearch(''); setFilter('all'); setDay(''); }}>Clear</button> : null}
      </div>
      {editor ? <TaskEditor key={editor.task?.id ?? 'new'} task={editor.task} saving={saving} onSave={runCommand} onClose={closeEditor} /> : null}
      {error ? (
        <div className="notice" role="alert">
          <p>{isTauri() ? error : 'Open the Taskflow desktop app to load your tasks.'}</p>
          {isTauri() ? <button type="button" disabled={loading || saving} onClick={() => { void reload(); }}>Reload tasks</button> : null}
        </div>
      ) : null}
      {reminderError ? <p className="notice" role="alert">{reminderError}</p> : null}
      {loading ? <p className="loading" role="status">Loading your tasks…</p> : null}
      {loaded ? <Timeline tasks={visibleTasks} now={now} disabled={disabled} onEdit={openEditor} onCommand={runCommand} /> : null}
      </main>
      {isTauri() ? <Composer disabled={disabled} modelState={modelStatus} modelError={modelDetails.failureMessage} imageCapable={modelDetails.vision} interpret={interpretUserRequest}
        onCommand={runCommand} onUnload={unloadModel} onOpenModels={openModelsFolder} onRefreshModels={refreshModelAvailability} /> : null}
    </div>
  );
}
