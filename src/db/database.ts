export type SqlValue = string | number | null;

// The desktop adapter will use @tauri-apps/plugin-sql. Tests use real SQLite.
export interface TaskDatabase {
  execute(sql: string, values?: SqlValue[]): Promise<{ rowsAffected: number }>;
  select<T>(sql: string, values?: SqlValue[]): Promise<T>;
}

let openDatabase: (() => Promise<TaskDatabase>) | undefined;
let databasePromise: Promise<TaskDatabase> | undefined;

export function configureDatabase(open: () => Promise<TaskDatabase>): void {
  openDatabase = open;
  databasePromise = undefined;
}

export function getDb(): Promise<TaskDatabase> {
  if (!openDatabase) return Promise.reject(new Error('Task database is not configured'));
  if (!databasePromise) {
    databasePromise = Promise.resolve().then(openDatabase).then(async (db) => {
      // Bootstrap only: all task row writes live in executeTaskCommand().
      await db.execute(`CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL CHECK (length(trim(title)) > 0),
        scheduled_at_utc TEXT NOT NULL,
        duration_minutes INTEGER CHECK (
          duration_minutes IS NULL OR
          (typeof(duration_minutes) = 'integer' AND duration_minutes > 0)
        ),
        status TEXT NOT NULL DEFAULT 'todo'
          CHECK (status IN ('todo', 'in_progress', 'done')),
        is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
        reminder_at_utc TEXT,
        created_at_utc TEXT NOT NULL,
        updated_at_utc TEXT NOT NULL,
        deleted_at_utc TEXT
      )`);
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_tasks_schedule
        ON tasks(scheduled_at_utc)`);
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_tasks_active
        ON tasks(deleted_at_utc, status, scheduled_at_utc)`);
      return db;
    }).catch((error: unknown) => {
      databasePromise = undefined;
      throw error;
    });
  }
  return databasePromise;
}
