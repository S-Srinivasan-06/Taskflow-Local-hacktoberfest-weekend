import { useEffect, useRef, useState } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { Timeline } from '../components/timeline/Timeline.tsx';
import { TaskEditor } from '../components/task/TaskEditor.tsx';
import { useTaskflow } from '../state/useTaskflow.ts';
import type { Task } from '../domain/task.ts';
import { Composer } from '../components/composer/Composer.tsx';
import { getModelStatus, interpretUserRequest, openModelsFolder, refreshModelAvailability, subscribeModelStatus, unloadModel } from '../model/desktopModel.ts';
import type { ModelStatus } from '../model/desktopModel.ts';

export function App() {
  const { tasks, loading, ready, loaded, saving, error, reload, runCommand } = useTaskflow();
  const [editor, setEditor] = useState<{ task: Task | null } | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [modelStatus, setModelStatus] = useState<ModelStatus>(getModelStatus().status);
  const newTaskButton = useRef<HTMLButtonElement>(null);
  const editorTrigger = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => subscribeModelStatus(() => setModelStatus(getModelStatus().status)), []);
  useEffect(() => { if (isTauri()) void refreshModelAvailability(); }, []);

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

  return (
    <div className="app-shell">
      <header className="app-header">
        <div><h1>TASKFLOW <span>LOCAL</span></h1><p className="muted">A time and a place for what’s next.</p></div>
        <button type="button" className="primary" ref={newTaskButton} disabled={disabled} onClick={() => openEditor(null)}>+ New task</button>
      </header>
      <div className="list-heading"><span>YOUR TIMELINE</span><span>{ready ? `${remaining} to do` : 'Works offline'}</span></div>
      {editor ? <TaskEditor key={editor.task?.id ?? 'new'} task={editor.task} saving={saving} onSave={runCommand} onClose={closeEditor} /> : null}
      {error ? (
        <div className="notice" role="alert">
          <p>{isTauri() ? error : 'Open the Taskflow desktop app to load your tasks.'}</p>
          {isTauri() ? <button type="button" disabled={loading || saving} onClick={() => { void reload(); }}>Reload tasks</button> : null}
        </div>
      ) : null}
      {loading ? <p className="loading" role="status">Loading your tasks…</p> : null}
      {loaded ? <Timeline tasks={tasks} now={now} disabled={disabled} onEdit={openEditor} onCommand={runCommand} /> : null}
      {isTauri() ? <Composer disabled={disabled} modelState={modelStatus} interpret={interpretUserRequest}
        onCommand={runCommand} onUnload={unloadModel} onOpenModels={openModelsFolder} onRefreshModels={refreshModelAvailability} /> : null}
      <footer className="app-footer"><span>Tasks stay on your computer</span><span>No account</span>
        <span role="status" aria-live="polite">{saving ? 'Saving…' : ready ? 'Saved locally' : 'Works offline'}</span>
        <span>Closing this window keeps Taskflow in the system tray. Use the tray menu to quit.</span>
      </footer>
    </div>
  );
}
