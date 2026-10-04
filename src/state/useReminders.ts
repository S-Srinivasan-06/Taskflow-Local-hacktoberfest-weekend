import { useEffect, useState } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification';
import { executeTaskCommand } from '../domain/taskService.ts';
import type { Task } from '../domain/task.ts';
import { reminderQueue } from '../domain/reminders.ts';

export async function enableReminders() {
  if (await isPermissionGranted()) return;
  if (await requestPermission() !== 'granted') throw new Error('Allow Taskflow notifications in Windows settings to use reminders.');
}

export function useReminders(tasks: Task[], ready: boolean, reload: () => Promise<void>) {
  const [error, setError] = useState('');
  const [listening, setListening] = useState(false);
  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    let unlisteners: Array<() => void> = [];
    void Promise.allSettled([
      listen<[string, string]>('reminder-fired', event => {
        if (cancelled) return;
        void executeTaskCommand({ type: 'acknowledge_reminder', taskId: event.payload[0], reminderAtUtc: event.payload[1] })
          .then(reload).catch(() => setError('A reminder was shown but its saved state could not update.'));
      }),
      listen<string>('reminder-error', event => { if (!cancelled) setError(event.payload); }),
    ]).then(results => {
      unlisteners = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
      if (cancelled || results.some(result => result.status === 'rejected')) {
        unlisteners.forEach(stop => stop());
        unlisteners = [];
        if (!cancelled) { setListening(false); setError('Reminders could not start.'); }
      } else setListening(true);
    });
    return () => { cancelled = true; unlisteners.forEach(stop => stop()); unlisteners = []; };
  }, [reload]);
  useEffect(() => {
    if (!listening) return;
    void invoke('sync_reminders', { tasks: ready ? reminderQueue(tasks) : [] }).catch(() => setError('Reminders could not be scheduled.'));
  }, [tasks, ready, listening]);
  return error;
}
