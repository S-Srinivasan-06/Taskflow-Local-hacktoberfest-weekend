import { isTauri } from '@tauri-apps/api/core';
import Database from '@tauri-apps/plugin-sql';
import { configureDatabase, getDb } from '../db/database.ts';

let bootstrapPromise: Promise<void> | undefined;

export function bootstrap(): Promise<void> {
  if (!isTauri()) {
    return Promise.reject(new Error('Open the Taskflow desktop app to load your tasks.'));
  }
  if (!bootstrapPromise) {
    configureDatabase(() => Database.load('sqlite:taskflow-local.db'));
    bootstrapPromise = getDb().then(() => undefined).catch((error: unknown) => {
      bootstrapPromise = undefined;
      throw error;
    });
  }
  return bootstrapPromise;
}
