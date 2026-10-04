import { useCallback, useEffect, useRef, useState } from 'react';
import { bootstrap } from '../app/bootstrap.ts';
import { listTimelineTasks } from '../db/taskRepository.ts';
import { executeTaskCommand } from '../domain/taskService.ts';
import type { TaskCommand } from '../domain/actions.ts';
import type { Task } from '../domain/task.ts';

export function useTaskflow() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const commandRunning = useRef(false);
  const mounted = useRef(false);
  const reloadPending = useRef(false);
  const readVersion = useRef(0);

  const reload = useCallback(async () => {
    if (commandRunning.current) { reloadPending.current = true; return; }
    const version = ++readVersion.current;
    setLoading(true);
    setError(null);
    try {
      await bootstrap();
      const rows = await listTimelineTasks();
      if (mounted.current && version === readVersion.current) {
        setTasks(rows);
        setReady(true);
        setLoaded(true);
      }
    } catch {
      if (mounted.current && version === readVersion.current) {
        setReady(false);
        setError('Your tasks could not be loaded. Try again.');
      }
    } finally {
      if (mounted.current && version === readVersion.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void reload();
    return () => { mounted.current = false; };
  }, [reload]);

  const runCommand = useCallback(async (command: TaskCommand): Promise<boolean> => {
    // A synchronous lock also stops double clicks before React disables controls.
    if (!ready || commandRunning.current) return false;
    commandRunning.current = true;
    ++readVersion.current;
    setLoading(false);
    setSaving(true);
    setError(null);
    let written = false;
    try {
      await executeTaskCommand(command);
      written = true;
      const rows = await listTimelineTasks();
      if (mounted.current) setTasks(rows);
      return true;
    } catch {
      if (mounted.current) {
        if (written) {
          setReady(false);
          setError('Your change was saved, but the list could not refresh. Reload your tasks.');
        } else {
          setError('That change could not be saved. Reload your tasks and try again.');
        }
      }
      // Close a saved editor even if refreshing fails; do not invite a duplicate create.
      return written;
    } finally {
      commandRunning.current = false;
      if (mounted.current) setSaving(false);
      if (reloadPending.current) {
        reloadPending.current = false;
        if (mounted.current) void reload();
      }
    }
  }, [ready, reload]);

  return { tasks, loading, ready, loaded, saving, error, reload, runCommand };
}
