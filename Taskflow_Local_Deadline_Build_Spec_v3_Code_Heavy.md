# Taskflow Local
## Deadline Build Specification v3 — Code-Heavy, Demo-First

**Target:** Windows desktop app for one friend  
**Deadline:** October 5, 2026, 06:59 UTC / 14:59 SGT  
**Product rule:** Taskflow Local is a task manager with a conversational control surface. It is not a chatbot product.  
**Build rule:** If a feature does not appear in the demo video, it is not V1.  
**Implementation rule:** Prove the model loop before polishing the shell.

---

# 0. What ships

The deadline build has exactly one important user journey:

1. Open Taskflow Local.
2. See a chronological task timeline.
3. Add a task manually.
4. Complete/reopen a task manually.
5. Type a natural-language request.
6. Taskflow starts the local model if necessary.
7. The model returns one schema-constrained JSON action.
8. Taskflow validates the action.
9. For mutations, Taskflow shows an approval card.
10. The user approves or cancels.
11. Approved changes go through the same task service used by manual UI controls.
12. Quit the app.
13. Reopen it.
14. The tasks are still there.

The required conversational actions are:

- create
- update / move / reschedule
- delete
- set status: `todo`, `in_progress`, `done`
- set read state: read / unread
- query tasks
- clarify when a request cannot be resolved safely

Manual use must work when the model is absent or stopped.

---

# 1. What does not ship before the deadline

Do not implement any of the following unless the full demo path already passes in an installed build:

- cloud sync
- login
- accounts
- collaboration
- remote backend
- REST API for third parties
- MCP
- plugins
- embeddings
- vector search
- RAG
- multi-agent orchestration
- LangChain
- LangGraph
- voice input
- voice output
- model selection UI
- model benchmarking UI
- automatic backups
- backup/restore UI
- launch at login
- global keyboard shortcuts
- window position persistence
- window size persistence
- multiple reminders per task
- recurrence
- projects
- labels
- folders
- workspaces
- kanban
- month calendar
- task duplication
- bulk mutations
- attachments
- rich text notes
- persisted chat history
- `proposed_actions` table
- event log table
- full undo history
- dynamic tray text such as `Next: ...`
- dynamic tray task list
- model download UI before the rest of the product works

The deadline build is intentionally small.

---

# 2. External facts checked before implementation

As checked on October 4, 2026:

- The specific Hugging Face repository `google/gemma-4-E2B-it-qat-q4_0-gguf` is visible without logging in.
- The repository reports license `Apache-2.0`.
- The text-only GGUF file is `gemma-4-E2B_q4_0-it.gguf`.
- The file is approximately 3.35 GB.
- The file page reports SHA-256:

```text
fa401b55b07ee70a54c6dae3903c783a6e65064312529ea57175cb5f8dec6634
```

- The repository includes a separate multimodal projection file; Taskflow Local does not need it for the deadline text-only build.
- The current model page documents llama.cpp usage.
- Current llama.cpp server documentation supports JSON-schema-constrained generation.
- Current llama.cpp server documentation supports passing `chat_template_kwargs`, including `enable_thinking: false`.
- Current llama.cpp server exposes `/health`; while loading it can return 503 and returns 200 when ready.

These are implementation inputs, not permanent assumptions. Pin the exact model and llama.cpp build used in the final demo.

## 2.1 Gating check still required

Even though this particular repository currently appears ungated, do this manually in Phase 0:

1. Open a private/incognito browser window.
2. Make sure no Hugging Face session is active.
3. Open the exact file page.
4. Click Download.
5. Confirm it begins without login or license acceptance.

If access changes later, the deadline fallback is **manual model placement**, not building authentication.

Do not spend deadline time implementing Hugging Face login.

## 2.2 Redistribution rule

For the deadline build, do not mirror the model.

The repo currently declares Apache-2.0, but if you later redistribute or mirror model artifacts, review the repository's current LICENSE/NOTICE/materials and preserve all required notices. Do not make licensing work part of the deadline path.

---

# 3. Final V1 stack

Use:

```text
Tauri 2
React
TypeScript
Vite
SQLite via @tauri-apps/plugin-sql
llama.cpp llama-server runtime
Gemma 4 E2B Q4 text GGUF
CSS transitions only, or the smallest animation dependency already present
```

Do not require the friend to install:

```text
Node.js
Rust
Python
Ollama
Docker
PostgreSQL
Java
Spring
CUDA toolkit
```

The friend should eventually receive a normal Windows installer EXE.

For the deadline demo, the model file may be placed manually in Taskflow Local's model folder.

---

# 4. Repository shape

Keep the repo small and obvious.

```text
taskflow-local/
├─ src/
│  ├─ app/
│  │  ├─ App.tsx
│  │  ├─ bootstrap.ts
│  │  └─ app.css
│  ├─ components/
│  │  ├─ timeline/
│  │  │  ├─ Timeline.tsx
│  │  │  ├─ TimelineTask.tsx
│  │  │  ├─ DayHeader.tsx
│  │  │  └─ NowMarker.tsx
│  │  ├─ composer/
│  │  │  ├─ Composer.tsx
│  │  │  ├─ ApprovalCard.tsx
│  │  │  ├─ QueryResult.tsx
│  │  │  └─ ClarificationCard.tsx
│  │  ├─ task/
│  │  │  ├─ TaskEditor.tsx
│  │  │  └─ StatusButton.tsx
│  │  └─ common/
│  │     ├─ Button.tsx
│  │     └─ InlineNotice.tsx
│  ├─ db/
│  │  ├─ database.ts
│  │  └─ taskRepository.ts
│  ├─ domain/
│  │  ├─ task.ts
│  │  ├─ actions.ts
│  │  └─ taskService.ts
│  ├─ model/
│  │  ├─ actionSchema.ts
│  │  ├─ context.ts
│  │  ├─ prompt.ts
│  │  ├─ llamaClient.ts
│  │  └─ modelService.ts
│  ├─ state/
│  │  └─ useTaskflow.ts
│  ├─ styles/
│  │  ├─ tokens.css
│  │  └─ globals.css
│  └─ main.tsx
│
├─ src-tauri/
│  ├─ src/
│  │  ├─ lib.rs
│  │  └─ model_process.rs
│  ├─ runtime/
│  │  └─ llama/
│  │     ├─ taskflow-llama.exe
│  │     ├─ *.dll
│  │     └─ [all other runtime files shipped beside the tested build]
│  ├─ icons/
│  ├─ Cargo.toml
│  └─ tauri.conf.json
│
├─ README.md
├─ package.json
└─ vite.config.ts
```

## 4.1 Do not copy the old Taskflow implementation

The challenge entry should be clearly new work.

From the original Taskflow repository, copy only design-system facts such as:

- exact colors
- exact font family
- exact border width
- exact border radius
- exact hard-shadow offsets
- relevant spacing constants

Do not copy old business logic, API code, backend code, task-service code, or large component implementations into this repo.

The intended relationship is:

```text
same visual family
new desktop product
new architecture
new implementation
```

---

# 5. Visual system — Taskflow neobrutalism, compressed

The application should look recognizably Taskflow, but denser and quieter.

Do not turn the desktop app into generic minimal SaaS UI.

Keep:

- hard borders
- hard-offset shadows
- high contrast
- direct typography
- rectangular controls
- visible interaction states
- restrained accent colors from the original project

Reduce:

- card padding
- giant headings
- decorative surfaces
- full-page layouts
- wide dashboard spacing
- large empty hero regions

Do not use:

- gradients
- glassmorphism
- glowing borders
- neon AI colors
- animated blobs
- assistant avatars
- sparkle icons as product branding
- “AI-powered” copy
- “copilot” copy
- “agent” copy in the user-facing UI

## 5.1 `tokens.css`

On day one, inspect the original Taskflow repo and put only its literal design values here.

Example shape; replace placeholder values with the original values before styling components:

```css
:root {
  /* Replace these with the original Taskflow values. */
  --tf-bg: #ffffff;
  --tf-fg: #111111;
  --tf-muted: #f1f1f1;
  --tf-accent: #f5dc57;
  --tf-danger: #ff6b6b;
  --tf-success: #8ee28e;

  --tf-border: 2px;
  --tf-radius: 4px;
  --tf-shadow-x: 3px;
  --tf-shadow-y: 3px;

  --tf-font: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;

  --tf-space-1: 4px;
  --tf-space-2: 8px;
  --tf-space-3: 12px;
  --tf-space-4: 16px;
  --tf-space-5: 24px;

  --tf-fast: 120ms;
  --tf-normal: 180ms;
}
```

Core component primitive:

```css
.tf-surface {
  background: var(--tf-bg);
  color: var(--tf-fg);
  border: var(--tf-border) solid var(--tf-fg);
  border-radius: var(--tf-radius);
  box-shadow:
    var(--tf-shadow-x)
    var(--tf-shadow-y)
    0
    var(--tf-fg);
}

.tf-button {
  appearance: none;
  border: var(--tf-border) solid var(--tf-fg);
  border-radius: var(--tf-radius);
  background: var(--tf-bg);
  color: var(--tf-fg);
  font: inherit;
  font-weight: 700;
  padding: 7px 10px;
  box-shadow: 2px 2px 0 var(--tf-fg);
  cursor: pointer;
  transition:
    transform var(--tf-fast) ease,
    box-shadow var(--tf-fast) ease,
    background var(--tf-fast) ease;
}

.tf-button:hover:not(:disabled) {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 var(--tf-fg);
}

.tf-button:active:not(:disabled) {
  transform: translate(2px, 2px);
  box-shadow: 0 0 0 var(--tf-fg);
}

.tf-button:disabled {
  opacity: 0.5;
  cursor: default;
}
```

Keep motion small:

```css
.task-row-enter {
  animation: task-row-enter var(--tf-normal) ease-out;
}

@keyframes task-row-enter {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.task-row[data-status="done"] {
  opacity: 0.58;
}

.task-row[data-status="done"] .task-title {
  text-decoration: line-through;
}
```

---

# 6. Main screen

There is one primary window.

```text
┌────────────────────────────────────────────┐
│ TASKFLOW                              —  × │
├────────────────────────────────────────────┤
│                                            │
│ Friday                                     │
│  20:30  ✓ Send notes                       │
│  21:15  ✓ Laundry                          │
│                                            │
│ ─────────── NOW · 23:07 ───────────────── │
│                                            │
│  23:30  ○ Finish report                    │
│          60 min                            │
│                                            │
│ Saturday                                   │
│  08:00  ○ Gym                              │
│  10:30  ○ Meeting                          │
│                                            │
├────────────────────────────────────────────┤
│ Tell Taskflow something…              Send │
└────────────────────────────────────────────┘
```

The timeline is the product.

The composer is a control surface attached to it.

Do not create a separate assistant page.

---

# 7. Database: exactly one table

The deadline build uses one SQLite table: `tasks`.

No `messages` table.  
No `proposals` table.  
No `events` table.  
No `reminders` table.

## 7.1 Schema

```sql
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,

  scheduled_at_utc TEXT NOT NULL,
  duration_minutes INTEGER,

  status TEXT NOT NULL DEFAULT 'todo'
    CHECK (status IN ('todo', 'in_progress', 'done')),

  is_read INTEGER NOT NULL DEFAULT 0
    CHECK (is_read IN (0, 1)),

  reminder_at_utc TEXT,

  created_at_utc TEXT NOT NULL,
  updated_at_utc TEXT NOT NULL,
  deleted_at_utc TEXT
);

CREATE INDEX IF NOT EXISTS idx_tasks_schedule
  ON tasks(scheduled_at_utc);

CREATE INDEX IF NOT EXISTS idx_tasks_active
  ON tasks(deleted_at_utc, status, scheduled_at_utc);
```

`reminder_at_utc` exists only because one reminder is cheap to represent. Reminder behavior is not a submission blocker.

There is deliberately no `due_at` field.

## 7.2 TypeScript task type

```ts
export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface Task {
  id: string;
  title: string;
  scheduledAtUtc: string;
  durationMinutes: number | null;
  status: TaskStatus;
  isRead: boolean;
  reminderAtUtc: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
  deletedAtUtc: string | null;
}
```

## 7.3 ID generation

Use UUIDs in storage.

```ts
export function newTaskId(): string {
  return crypto.randomUUID();
}
```

The model can copy task IDs from a provided task list. Always validate the returned ID before mutation.

---

# 8. Database bootstrap

Install the plugin:

```bash
npm install @tauri-apps/plugin-sql
cd src-tauri
cargo add tauri-plugin-sql --features sqlite
```

Register it in the Tauri builder:

```rust
.plugin(tauri_plugin_sql::Builder::default().build())
```

The TypeScript `Database.load('sqlite:taskflow-local.db')` call creates/opens the persistent SQLite database and runs any migrations registered for that connection. For the deadline build, the idempotent `CREATE TABLE IF NOT EXISTS` bootstrap below is sufficient.

## 8.1 `database.ts`

```ts
import Database from '@tauri-apps/plugin-sql';

let dbPromise: Promise<Database> | null = null;

export function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load('sqlite:taskflow-local.db');
  }
  return dbPromise;
}

export async function initDb(): Promise<void> {
  const db = await getDb();

  await db.execute(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      scheduled_at_utc TEXT NOT NULL,
      duration_minutes INTEGER,
      status TEXT NOT NULL DEFAULT 'todo'
        CHECK (status IN ('todo', 'in_progress', 'done')),
      is_read INTEGER NOT NULL DEFAULT 0
        CHECK (is_read IN (0, 1)),
      reminder_at_utc TEXT,
      created_at_utc TEXT NOT NULL,
      updated_at_utc TEXT NOT NULL,
      deleted_at_utc TEXT
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_tasks_schedule
    ON tasks(scheduled_at_utc)
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_tasks_active
    ON tasks(deleted_at_utc, status, scheduled_at_utc)
  `);
}
```

Call it before rendering app state:

```ts
import { initDb } from './db/database';

export async function bootstrap(): Promise<void> {
  await initDb();
}
```

---

# 9. Repository implementation

## 9.1 Row mapping

```ts
interface TaskRow {
  id: string;
  title: string;
  scheduled_at_utc: string;
  duration_minutes: number | null;
  status: TaskStatus;
  is_read: number;
  reminder_at_utc: string | null;
  created_at_utc: string;
  updated_at_utc: string;
  deleted_at_utc: string | null;
}

function mapTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    scheduledAtUtc: row.scheduled_at_utc,
    durationMinutes: row.duration_minutes,
    status: row.status,
    isRead: row.is_read === 1,
    reminderAtUtc: row.reminder_at_utc,
    createdAtUtc: row.created_at_utc,
    updatedAtUtc: row.updated_at_utc,
    deletedAtUtc: row.deleted_at_utc,
  };
}
```

## 9.2 Load timeline

```ts
export async function listTimelineTasks(): Promise<Task[]> {
  const db = await getDb();

  const rows = await db.select<TaskRow[]>(`
    SELECT *
    FROM tasks
    WHERE deleted_at_utc IS NULL
    ORDER BY scheduled_at_utc ASC
  `);

  return rows.map(mapTask);
}
```

## 9.3 Get by ID

```ts
export async function getTaskById(id: string): Promise<Task | null> {
  const db = await getDb();

  const rows = await db.select<TaskRow[]>(
    `SELECT * FROM tasks WHERE id = ? LIMIT 1`,
    [id],
  );

  return rows[0] ? mapTask(rows[0]) : null;
}
```

## 9.4 Create

```ts
export interface CreateTaskInput {
  title: string;
  scheduledAtUtc: string;
  durationMinutes?: number | null;
  status?: TaskStatus;
  isRead?: boolean;
  reminderAtUtc?: string | null;
}

export async function insertTask(input: CreateTaskInput): Promise<Task> {
  const db = await getDb();
  const now = new Date().toISOString();

  const task: Task = {
    id: crypto.randomUUID(),
    title: input.title.trim(),
    scheduledAtUtc: input.scheduledAtUtc,
    durationMinutes: input.durationMinutes ?? null,
    status: input.status ?? 'todo',
    isRead: input.isRead ?? false,
    reminderAtUtc: input.reminderAtUtc ?? null,
    createdAtUtc: now,
    updatedAtUtc: now,
    deletedAtUtc: null,
  };

  await db.execute(
    `INSERT INTO tasks (
      id,
      title,
      scheduled_at_utc,
      duration_minutes,
      status,
      is_read,
      reminder_at_utc,
      created_at_utc,
      updated_at_utc,
      deleted_at_utc
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    [
      task.id,
      task.title,
      task.scheduledAtUtc,
      task.durationMinutes,
      task.status,
      task.isRead ? 1 : 0,
      task.reminderAtUtc,
      task.createdAtUtc,
      task.updatedAtUtc,
    ],
  );

  return task;
}
```

## 9.5 Update

```ts
export interface UpdateTaskInput {
  title?: string;
  scheduledAtUtc?: string;
  durationMinutes?: number | null;
  reminderAtUtc?: string | null;
}

export async function updateTask(
  id: string,
  patch: UpdateTaskInput,
): Promise<void> {
  const existing = await getTaskById(id);
  if (!existing || existing.deletedAtUtc) {
    throw new Error('Task not found');
  }

  const next = {
    title: patch.title?.trim() ?? existing.title,
    scheduledAtUtc: patch.scheduledAtUtc ?? existing.scheduledAtUtc,
    durationMinutes:
      patch.durationMinutes === undefined
        ? existing.durationMinutes
        : patch.durationMinutes,
    reminderAtUtc:
      patch.reminderAtUtc === undefined
        ? existing.reminderAtUtc
        : patch.reminderAtUtc,
    updatedAtUtc: new Date().toISOString(),
  };

  const db = await getDb();
  await db.execute(
    `UPDATE tasks
     SET title = ?,
         scheduled_at_utc = ?,
         duration_minutes = ?,
         reminder_at_utc = ?,
         updated_at_utc = ?
     WHERE id = ?`,
    [
      next.title,
      next.scheduledAtUtc,
      next.durationMinutes,
      next.reminderAtUtc,
      next.updatedAtUtc,
      id,
    ],
  );
}
```

## 9.6 Status

```ts
export async function setTaskStatus(
  id: string,
  status: TaskStatus,
): Promise<void> {
  const db = await getDb();
  const result = await db.execute(
    `UPDATE tasks
     SET status = ?, updated_at_utc = ?
     WHERE id = ? AND deleted_at_utc IS NULL`,
    [status, new Date().toISOString(), id],
  );

  if (result.rowsAffected !== 1) {
    throw new Error('Task not found');
  }
}
```

## 9.7 Read / unread

This is required in V1.

```ts
export async function setTaskRead(
  id: string,
  isRead: boolean,
): Promise<void> {
  const db = await getDb();
  const result = await db.execute(
    `UPDATE tasks
     SET is_read = ?, updated_at_utc = ?
     WHERE id = ? AND deleted_at_utc IS NULL`,
    [isRead ? 1 : 0, new Date().toISOString(), id],
  );

  if (result.rowsAffected !== 1) {
    throw new Error('Task not found');
  }
}
```

## 9.8 Soft delete

```ts
export async function softDeleteTask(id: string): Promise<void> {
  const now = new Date().toISOString();
  const db = await getDb();

  const result = await db.execute(
    `UPDATE tasks
     SET deleted_at_utc = ?, updated_at_utc = ?
     WHERE id = ? AND deleted_at_utc IS NULL`,
    [now, now, id],
  );

  if (result.rowsAffected !== 1) {
    throw new Error('Task not found');
  }
}
```

## 9.9 Restore for a one-level undo

```ts
export async function restoreDeletedTask(id: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE tasks
     SET deleted_at_utc = NULL, updated_at_utc = ?
     WHERE id = ?`,
    [new Date().toISOString(), id],
  );
}
```

Do not persist undo history. Keep only one in-memory undo callback.

---

# 10. One mutation path

Manual controls and model-approved changes must call the same task service.

## 10.1 Commands

```ts
export type TaskCommand =
  | {
      type: 'create';
      payload: CreateTaskInput;
    }
  | {
      type: 'update';
      taskId: string;
      payload: UpdateTaskInput;
    }
  | {
      type: 'delete';
      taskId: string;
    }
  | {
      type: 'set_status';
      taskId: string;
      status: TaskStatus;
    }
  | {
      type: 'set_read';
      taskId: string;
      isRead: boolean;
    };
```

## 10.2 Service

```ts
let lastUndo: (() => Promise<void>) | null = null;

export async function executeTaskCommand(command: TaskCommand): Promise<void> {
  switch (command.type) {
    case 'create': {
      const task = await insertTask(command.payload);
      lastUndo = async () => {
        await softDeleteTask(task.id);
      };
      return;
    }

    case 'update': {
      const before = await getTaskById(command.taskId);
      if (!before) throw new Error('Task not found');

      await updateTask(command.taskId, command.payload);

      lastUndo = async () => {
        await updateTask(command.taskId, {
          title: before.title,
          scheduledAtUtc: before.scheduledAtUtc,
          durationMinutes: before.durationMinutes,
          reminderAtUtc: before.reminderAtUtc,
        });
      };
      return;
    }

    case 'delete': {
      await softDeleteTask(command.taskId);
      lastUndo = async () => {
        await restoreDeletedTask(command.taskId);
      };
      return;
    }

    case 'set_status': {
      const before = await getTaskById(command.taskId);
      if (!before) throw new Error('Task not found');

      await setTaskStatus(command.taskId, command.status);
      lastUndo = async () => {
        await setTaskStatus(command.taskId, before.status);
      };
      return;
    }

    case 'set_read': {
      const before = await getTaskById(command.taskId);
      if (!before) throw new Error('Task not found');

      await setTaskRead(command.taskId, command.isRead);
      lastUndo = async () => {
        await setTaskRead(command.taskId, before.isRead);
      };
      return;
    }
  }
}

export async function undoLastAction(): Promise<boolean> {
  if (!lastUndo) return false;

  const undo = lastUndo;
  lastUndo = null;
  await undo();
  return true;
}
```

Undo is nice to have, not demo-critical.

---

# 11. Date handling

The model will receive a 14-day date table.

The model returns a local timestamp.

The app validates it and converts it to UTC before storing it.

Do not build a complicated natural-language date parser before the deadline.

## 11.1 Local ISO helpers

```ts
export function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function toLocalIsoWithoutOffset(date: Date): string {
  return [
    date.getFullYear(),
    '-',
    pad2(date.getMonth() + 1),
    '-',
    pad2(date.getDate()),
    'T',
    pad2(date.getHours()),
    ':',
    pad2(date.getMinutes()),
    ':',
    pad2(date.getSeconds()),
  ].join('');
}

export function localIsoToUtc(localIso: string): string {
  // A datetime without an offset is interpreted as local time in JS.
  const parsed = new Date(localIso);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid date/time');
  }

  return parsed.toISOString();
}
```

## 11.2 Validate model time

```ts
const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

export function validateLocalDateTime(value: string | null): string | null {
  if (value === null) return null;

  if (!LOCAL_DATE_TIME.test(value)) {
    throw new Error(`Invalid local datetime format: ${value}`);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid local datetime: ${value}`);
  }

  return value;
}
```

## 11.3 Next 14 days table

```ts
export interface DateReferenceRow {
  label: string;
  isoDate: string;
}

export function buildNext14Days(now = new Date()): DateReferenceRow[] {
  const fmt = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const rows: DateReferenceRow[] = [];

  for (let offset = 0; offset < 14; offset += 1) {
    const d = new Date(now);
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + offset);

    rows.push({
      label: fmt.format(d),
      isoDate: [
        d.getFullYear(),
        pad2(d.getMonth() + 1),
        pad2(d.getDate()),
      ].join('-'),
    });
  }

  return rows;
}

export function formatDateReferenceTable(now = new Date()): string {
  return buildNext14Days(now)
    .map((row, index) => `${index}: ${row.label} => ${row.isoDate}`)
    .join('\n');
}
```

Example prompt fragment:

```text
DATE REFERENCE
0: Sunday, October 4, 2026 => 2026-10-04
1: Monday, October 5, 2026 => 2026-10-05
2: Tuesday, October 6, 2026 => 2026-10-06
...
13: Saturday, October 17, 2026 => 2026-10-17
```

This is deliberately redundant. Small models benefit from explicit anchors.

---

# 12. Task resolution: provide candidates to the model

Do not make the model infer task identity from text search alone.

For every conversational request, provide up to 25 relevant non-deleted tasks.

The model must return a `task_id` from that list for actions that target an existing task.

Text search is only a fallback.

## 12.1 Candidate selection

Prioritize unfinished tasks nearest to now.

```ts
export async function getModelTaskContext(limit = 25): Promise<Task[]> {
  const db = await getDb();
  const now = new Date().toISOString();

  const rows = await db.select<TaskRow[]>(
    `SELECT *
     FROM tasks
     WHERE deleted_at_utc IS NULL
     ORDER BY
       CASE WHEN status = 'done' THEN 1 ELSE 0 END ASC,
       ABS(julianday(scheduled_at_utc) - julianday(?)) ASC,
       scheduled_at_utc ASC
     LIMIT ?`,
    [now, limit],
  );

  return rows.map(mapTask);
}
```

## 12.2 Prompt representation

```ts
export function formatTaskContext(tasks: Task[]): string {
  if (tasks.length === 0) {
    return '(no tasks)';
  }

  return tasks
    .map((task, index) => {
      const local = new Date(task.scheduledAtUtc);
      return [
        `${index + 1}.`,
        `id=${task.id}`,
        `status=${task.status}`,
        `read=${task.isRead ? 'yes' : 'no'}`,
        `time=${toLocalIsoWithoutOffset(local)}`,
        `duration=${task.durationMinutes ?? 'null'}`,
        `title=${JSON.stringify(task.title)}`,
      ].join(' | ');
    })
    .join('\n');
}
```

Example:

```text
OPEN / NEARBY TASKS
1. id=2f0d... | status=todo | read=no | time=2026-10-04T20:00:00 | duration=60 | title="Send project files to Srini"
2. id=8b65... | status=in_progress | read=yes | time=2026-10-05T08:00:00 | duration=45 | title="Gym"
```

A request such as:

```text
I already sent the files
```

can now map to the actual task ID even though the wording is not an exact title match.

## 12.3 ID validation

Never trust an arbitrary model-provided ID.

```ts
export function assertTaskIdAllowed(
  taskId: string | null,
  candidates: Task[],
): Task | null {
  if (!taskId) return null;

  const task = candidates.find((candidate) => candidate.id === taskId);
  if (!task) {
    throw new Error('Model returned a task ID outside the provided context');
  }

  return task;
}
```

## 12.4 LIKE fallback

Only use fallback search if the action has no valid ID and the user clearly refers to an existing task.

```ts
export async function searchTasksByTitle(
  text: string,
  limit = 5,
): Promise<Task[]> {
  const db = await getDb();
  const q = `%${text.trim().replaceAll('%', '')}%`;

  const rows = await db.select<TaskRow[]>(
    `SELECT *
     FROM tasks
     WHERE deleted_at_utc IS NULL
       AND title LIKE ? COLLATE NOCASE
     ORDER BY scheduled_at_utc ASC
     LIMIT ?`,
    [q, limit],
  );

  return rows.map(mapTask);
}
```

If more than one candidate remains plausible, ask the user rather than guessing.

---

# 13. The entire model contract: one JSON schema

There is no tool-calling loop.

There are no model tools.

There is one request and one constrained JSON object.

## 13.1 TypeScript type

```ts
export type ModelActionName =
  | 'create'
  | 'update'
  | 'delete'
  | 'set_status'
  | 'set_read'
  | 'query'
  | 'clarify';

export interface ModelAction {
  action: ModelActionName;

  // Existing-task mutations.
  task_id: string | null;

  // Create/update fields.
  title: string | null;
  scheduled_at_local: string | null;
  duration_minutes: number | null;

  // Status/read mutations.
  status: TaskStatus | null;
  is_read: boolean | null;

  // Query fields.
  query_kind: 'range' | 'open' | 'unread' | 'done' | null;
  query_start_local: string | null;
  query_end_local: string | null;

  // Clarification only.
  clarification_question: string | null;
}
```

## 13.2 JSON schema passed to llama-server

Keep the schema simple. Avoid complicated conditional constructs that might expose edge cases in JSON-schema-to-grammar conversion.

```ts
export const TASKFLOW_ACTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    action: {
      type: 'string',
      enum: [
        'create',
        'update',
        'delete',
        'set_status',
        'set_read',
        'query',
        'clarify',
      ],
    },
    task_id: {
      type: ['string', 'null'],
    },
    title: {
      type: ['string', 'null'],
    },
    scheduled_at_local: {
      type: ['string', 'null'],
    },
    duration_minutes: {
      type: ['integer', 'null'],
      minimum: 1,
      maximum: 1440,
    },
    status: {
      type: ['string', 'null'],
      enum: ['todo', 'in_progress', 'done', null],
    },
    is_read: {
      type: ['boolean', 'null'],
    },
    query_kind: {
      type: ['string', 'null'],
      enum: ['range', 'open', 'unread', 'done', null],
    },
    query_start_local: {
      type: ['string', 'null'],
    },
    query_end_local: {
      type: ['string', 'null'],
    },
    clarification_question: {
      type: ['string', 'null'],
    },
  },
  required: [
    'action',
    'task_id',
    'title',
    'scheduled_at_local',
    'duration_minutes',
    'status',
    'is_read',
    'query_kind',
    'query_start_local',
    'query_end_local',
    'clarification_question',
  ],
} as const;
```

If the installed llama.cpp build does not accept union `type: ['string', 'null']`, change nullable fields to a compatible schema form in Phase 0 and freeze that version. Do not redesign the model interface later.

---

# 14. Runtime validation after schema-constrained generation

Constrained generation reduces malformed JSON. It does not remove semantic validation.

Validate every response.

## 14.1 Lightweight parser

Use Zod if already acceptable for the project:

```bash
npm install zod
```

```ts
import { z } from 'zod';

const NullableLocalIso = z.string().nullable();

export const ModelActionZ = z.object({
  action: z.enum([
    'create',
    'update',
    'delete',
    'set_status',
    'set_read',
    'query',
    'clarify',
  ]),
  task_id: z.string().nullable(),
  title: z.string().nullable(),
  scheduled_at_local: NullableLocalIso,
  duration_minutes: z.number().int().min(1).max(1440).nullable(),
  status: z.enum(['todo', 'in_progress', 'done']).nullable(),
  is_read: z.boolean().nullable(),
  query_kind: z.enum(['range', 'open', 'unread', 'done']).nullable(),
  query_start_local: NullableLocalIso,
  query_end_local: NullableLocalIso,
  clarification_question: z.string().nullable(),
});

export function parseModelAction(json: string): ModelAction {
  return ModelActionZ.parse(JSON.parse(json));
}
```

## 14.2 Semantic checks

```ts
export function validateModelAction(
  action: ModelAction,
  candidates: Task[],
): ModelAction {
  const needsExistingTask = new Set([
    'update',
    'delete',
    'set_status',
    'set_read',
  ]);

  if (needsExistingTask.has(action.action)) {
    if (!action.task_id) {
      throw new Error(`${action.action} requires task_id`);
    }

    assertTaskIdAllowed(action.task_id, candidates);
  }

  if (action.action === 'create') {
    if (!action.title?.trim()) {
      throw new Error('create requires title');
    }
    if (!action.scheduled_at_local) {
      throw new Error('create requires scheduled_at_local');
    }
    validateLocalDateTime(action.scheduled_at_local);
  }

  if (action.action === 'update') {
    if (action.scheduled_at_local) {
      validateLocalDateTime(action.scheduled_at_local);
    }

    if (
      action.title === null &&
      action.scheduled_at_local === null &&
      action.duration_minutes === null
    ) {
      throw new Error('update has no fields to change');
    }
  }

  if (action.action === 'set_status' && action.status === null) {
    throw new Error('set_status requires status');
  }

  if (action.action === 'set_read' && action.is_read === null) {
    throw new Error('set_read requires is_read');
  }

  if (action.action === 'query' && action.query_kind === 'range') {
    if (!action.query_start_local || !action.query_end_local) {
      throw new Error('range query requires start and end');
    }
    validateLocalDateTime(action.query_start_local);
    validateLocalDateTime(action.query_end_local);
  }

  if (action.action === 'clarify') {
    if (!action.clarification_question?.trim()) {
      throw new Error('clarify requires clarification_question');
    }
  }

  return action;
}
```

If validation fails, do one retry with a short correction prompt. Do not build a multi-step repair agent.

---

# 15. Prompt

The system prompt should be boring and explicit.

Small models generally benefit more from concrete examples and constrained output than from elaborate persona text.

## 15.1 Prompt builder

```ts
export interface PromptContext {
  now: Date;
  tasks: Task[];
}

export function buildSystemPrompt(context: PromptContext): string {
  const currentLocal = toLocalIsoWithoutOffset(context.now);
  const weekday = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
  }).format(context.now);

  return `
You convert one user request into exactly one Taskflow action.

You are not a general chatbot.
You do not execute actions.
You only describe the requested action as JSON matching the provided schema.

CURRENT LOCAL TIME
${currentLocal}
Weekday: ${weekday}

NEXT 14 DAYS
${formatDateReferenceTable(context.now)}

AVAILABLE TASKS
${formatTaskContext(context.tasks)}

RULES
1. For update, delete, set_status, or set_read, choose task_id only from AVAILABLE TASKS.
2. Never invent a task_id.
3. If the user refers to an existing task but no task is a safe match, use action=clarify.
4. Resolve relative dates using CURRENT LOCAL TIME and NEXT 14 DAYS.
5. scheduled_at_local must use YYYY-MM-DDTHH:mm:ss with no timezone suffix.
6. Use the user's language only for clarification_question. JSON field names remain unchanged.
7. "finished", "done", "completed" -> set_status status=done.
8. "started", "working on", "in progress" -> set_status status=in_progress.
9. "reopen", "not done", "put it back" -> set_status status=todo.
10. "mark read" -> set_read is_read=true.
11. "mark unread" -> set_read is_read=false.
12. For query requests, do not fabricate tasks. Return a query description only.
13. If the user gives a duration such as "for one hour", return duration_minutes=60.
14. If duration is absent, use null.
15. Return exactly one action.

EXAMPLES

USER: Add gym tomorrow at 7 for one hour
OUTPUT:
{"action":"create","task_id":null,"title":"Gym","scheduled_at_local":"DATE_FROM_REFERENCE_AT_07:00:00","duration_minutes":60,"status":null,"is_read":null,"query_kind":null,"query_start_local":null,"query_end_local":null,"clarification_question":null}

USER: I already sent the files
OUTPUT:
{"action":"set_status","task_id":"ID_OF_SEND_FILES_TASK_FROM_AVAILABLE_TASKS","title":null,"scheduled_at_local":null,"duration_minutes":null,"status":"done","is_read":null,"query_kind":null,"query_start_local":null,"query_end_local":null,"clarification_question":null}

USER: Move gym to 9 tomorrow
OUTPUT:
{"action":"update","task_id":"ID_OF_GYM_TASK_FROM_AVAILABLE_TASKS","title":null,"scheduled_at_local":"DATE_FROM_REFERENCE_AT_09:00:00","duration_minutes":null,"status":null,"is_read":null,"query_kind":null,"query_start_local":null,"query_end_local":null,"clarification_question":null}

USER: Mark the report unread
OUTPUT:
{"action":"set_read","task_id":"ID_OF_REPORT_TASK_FROM_AVAILABLE_TASKS","title":null,"scheduled_at_local":null,"duration_minutes":null,"status":null,"is_read":false,"query_kind":null,"query_start_local":null,"query_end_local":null,"clarification_question":null}

USER: What do I have tonight?
OUTPUT:
{"action":"query","task_id":null,"title":null,"scheduled_at_local":null,"duration_minutes":null,"status":null,"is_read":null,"query_kind":"range","query_start_local":"TODAY_AT_17:00:00","query_end_local":"TODAY_AT_23:59:59","clarification_question":null}

When an example contains placeholders such as DATE_FROM_REFERENCE, replace them with real values using the provided date table.
`.trim();
}
```

The final production prompt should replace placeholder examples with actual fixed dates generated at runtime, or include example dates that are clearly described as examples.

## 15.2 Better approach: generate examples using today's table

```ts
function atLocal(date: Date, hour: number, minute = 0): string {
  const d = new Date(date);
  d.setHours(hour, minute, 0, 0);
  return toLocalIsoWithoutOffset(d);
}

export function buildDynamicExamples(now: Date, tasks: Task[]): string {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const filesTask = tasks.find((t) =>
    t.title.toLowerCase().includes('file'),
  );

  return `
EXAMPLE CREATE
User: Add gym tomorrow at 7 for one hour
JSON: ${JSON.stringify({
    action: 'create',
    task_id: null,
    title: 'Gym',
    scheduled_at_local: atLocal(tomorrow, 7),
    duration_minutes: 60,
    status: null,
    is_read: null,
    query_kind: null,
    query_start_local: null,
    query_end_local: null,
    clarification_question: null,
  })}

EXAMPLE QUERY
User: What do I have tonight?
JSON: ${JSON.stringify({
    action: 'query',
    task_id: null,
    title: null,
    scheduled_at_local: null,
    duration_minutes: null,
    status: null,
    is_read: null,
    query_kind: 'range',
    query_start_local: atLocal(now, 17),
    query_end_local: atLocal(now, 23, 59),
    clarification_question: null,
  })}

${
  filesTask
    ? `EXAMPLE EXISTING TASK\nUser: I already sent the files\nJSON: ${JSON.stringify({
        action: 'set_status',
        task_id: filesTask.id,
        title: null,
        scheduled_at_local: null,
        duration_minutes: null,
        status: 'done',
        is_read: null,
        query_kind: null,
        query_start_local: null,
        query_end_local: null,
        clarification_question: null,
      })}`
    : ''
}
`.trim();
}
```

Five examples is enough. Do not bury the model in a 100-example prompt.

---

# 16. llama-server call

Use schema-constrained JSON every time.

Do not use “JSON mode if available.”

Do not parse free-form prose.

## 16.1 Request

```ts
const LLAMA_BASE_URL = 'http://127.0.0.1:39281';

interface LlamaChatResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export async function requestActionFromModel(
  userText: string,
  systemPrompt: string,
): Promise<string> {
  const response = await fetch(`${LLAMA_BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'taskflow-local',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userText,
        },
      ],
      temperature: 0,
      max_tokens: 256,
      stream: false,

      // Required: schema-constrained output.
      response_format: {
        type: 'json_schema',
        schema: TASKFLOW_ACTION_SCHEMA,
      },

      // Required: keep task parsing fast; do not expose reasoning output.
      chat_template_kwargs: {
        enable_thinking: false,
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Model request failed: ${response.status} ${detail}`);
  }

  const json = (await response.json()) as LlamaChatResponse;
  const content = json.choices[0]?.message?.content;

  if (!content) {
    throw new Error('Model returned no content');
  }

  return content;
}
```

Pin the exact llama.cpp build after Phase 0. If the exact accepted `response_format` shape differs for that pinned build, change it once and document it. Do not make the client support multiple llama.cpp dialects before submission.

---

# 17. One request at a time

There should never be two model requests running concurrently.

The simplest implementation is UI lock + service lock.

## 17.1 Service lock

```ts
let requestInFlight = false;

export async function withModelLock<T>(fn: () => Promise<T>): Promise<T> {
  if (requestInFlight) {
    throw new Error('A request is already running');
  }

  requestInFlight = true;
  try {
    return await fn();
  } finally {
    requestInFlight = false;
  }
}
```

## 17.2 Composer

```tsx
export function Composer() {
  const [text, setText] = useState('');
  const [running, setRunning] = useState(false);

  async function submit() {
    const trimmed = text.trim();
    if (!trimmed || running) return;

    setRunning(true);
    try {
      await interpretUserRequest(trimmed);
      setText('');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="composer tf-surface">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={running}
        placeholder={running ? 'Working…' : 'Tell Taskflow something…'}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void submit();
          }
        }}
      />

      <button
        className="tf-button"
        disabled={running || !text.trim()}
        onClick={() => void submit()}
      >
        {running ? 'Working…' : 'Send'}
      </button>
    </div>
  );
}
```

No queue. No parallel inference.

---

# 18. Model lifecycle

The local model is not loaded at app startup.

App startup should remain useful without the model.

States:

```ts
export type ModelState =
  | 'missing'
  | 'stopped'
  | 'starting'
  | 'ready'
  | 'error';
```

Expected flow:

```text
app opens
  ↓
model process absent
  ↓
user can manually use tasks
  ↓
user sends natural-language request
  ↓
show "Starting…"
  ↓
spawn model runtime
  ↓
health 503 while loading
  ↓
health 200
  ↓
run request
  ↓
keep runtime alive
  ↓
reset 30-minute idle timer after every model request
  ↓
30 minutes pass
  ↓
kill runtime
```

For development, use 60 seconds.

```ts
export const MODEL_IDLE_MS = import.meta.env.DEV
  ? 60_000
  : 30 * 60_000;
```

---

# 19. Model file location for the deadline

If using the TypeScript examples below, install the narrow Tauri helpers you actually use:

```bash
npm install @tauri-apps/plugin-fs @tauri-apps/plugin-opener
```

Register those plugins/capabilities according to the exact pinned Tauri 2 plugin versions, with filesystem scope limited to Taskflow Local's app-local model directory.

Do not build a 3.35 GB downloader before the demo works.

The deadline behavior when the model is missing is:

```text
Local model not found.
Place gemma-4-E2B_q4_0-it.gguf in the Models folder.

[Open Models Folder]
```

Expected path:

```text
%LOCALAPPDATA%\<bundle-identifier>\models\gemma-4-E2B_q4_0-it.gguf
```

The exact base directory should come from Tauri's app local data directory API, not a hand-written Windows path.

## 19.1 TypeScript path helper

```ts
import { appLocalDataDir, join } from '@tauri-apps/api/path';

export const EXPECTED_MODEL_FILENAME = 'gemma-4-E2B_q4_0-it.gguf';

export async function getModelDirectory(): Promise<string> {
  return join(await appLocalDataDir(), 'models');
}

export async function getExpectedModelPath(): Promise<string> {
  return join(await getModelDirectory(), EXPECTED_MODEL_FILENAME);
}
```

The user may be assumed to place the exact correct model name there for the deadline.

No model picker is required.

---

# 20. Bundling llama.cpp on Windows

This is a high-risk packaging area. Treat the exact runtime folder as one tested unit.

Do not bundle only `llama-server.exe` and assume Windows will find its DLLs.

For the deadline:

1. Choose one exact Windows llama.cpp release/build.
2. Extract it.
3. Test the exact `llama-server.exe` with the exact Gemma GGUF.
4. Rename the executable to a Taskflow-specific process name such as `taskflow-llama.exe`.
5. Copy the executable **and every DLL/runtime file shipped beside it that the executable depends on** into:

```text
src-tauri/runtime/llama/
```

6. Bundle the directory as Tauri resources.
7. Spawn that resource path from Rust.
8. Test the installed NSIS application, not only `tauri dev`.

## 20.1 Why rename the process

A unique image name allows startup cleanup to target Taskflow's orphaned process without killing an unrelated user's `llama-server.exe`.

Use:

```text
taskflow-llama.exe
```

not:

```text
llama-server.exe
```

in the packaged runtime directory.

---

# 21. Tauri resource config

Prefer bundling the entire runtime directory as resources rather than relying on `externalBin` for one executable.

Conceptual `tauri.conf.json`:

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Taskflow Local",
  "version": "0.1.0",
  "identifier": "com.srinivasan.taskflow-local",
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "Taskflow Local",
        "width": 520,
        "height": 720,
        "minWidth": 420,
        "minHeight": 520,
        "resizable": true
      }
    ]
  },
  "bundle": {
    "active": true,
    "targets": ["nsis"],
    "resources": [
      "runtime/llama/**/*"
    ],
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/icon.ico"
    ]
  }
}
```

If the actual project version requires a different resource glob or path form, use the documented Tauri 2 form for that pinned version.

---

# 22. Rust: the deliberately small native layer

Rust has only a few deadline responsibilities:

- locate bundled runtime resources
- start Taskflow's llama.cpp process
- stop it
- kill stale Taskflow model processes on startup
- optionally open the model folder if not handled through an existing plugin
- optional later: stream model download + hash verification

Everything else stays in TypeScript.

## 22.1 State

```rust
use std::process::Child;
use std::sync::Mutex;

pub struct ModelProcessState {
    pub child: Mutex<Option<Child>>,
}

impl Default for ModelProcessState {
    fn default() -> Self {
        Self {
            child: Mutex::new(None),
        }
    }
}
```

## 22.2 Resolve packaged runtime executable

```rust
use tauri::path::BaseDirectory;
use tauri::Manager;
use std::path::PathBuf;

fn resolve_model_runtime_exe(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .resolve(
            "runtime/llama/taskflow-llama.exe",
            BaseDirectory::Resource,
        )
        .map_err(|e| e.to_string())
}
```

## 22.3 Kill stale orphan on startup

For the deadline Windows build, use the renamed image name.

```rust
#[cfg(target_os = "windows")]
fn kill_stale_taskflow_llama() {
    let _ = std::process::Command::new("taskkill")
        .args(["/F", "/T", "/IM", "taskflow-llama.exe"])
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .status();
}
```

You need:

```rust
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
```

This cleanup is acceptable for the deadline because the executable name is Taskflow-specific.

Do not use `/IM llama-server.exe`; that could kill someone else's process.

## 22.4 Start command

```rust
use std::process::{Command, Stdio};

const MODEL_HOST: &str = "127.0.0.1";
const MODEL_PORT: &str = "39281";
const MODEL_CONTEXT: &str = "4096";

#[tauri::command]
pub fn start_model_process(
    app: tauri::AppHandle,
    state: tauri::State<ModelProcessState>,
    model_path: String,
) -> Result<(), String> {
    let mut guard = state.child.lock().map_err(|_| "model lock poisoned")?;

    if let Some(child) = guard.as_mut() {
        match child.try_wait() {
            Ok(None) => return Ok(()), // already running
            Ok(Some(_)) | Err(_) => {
                *guard = None; // dead handle; start a fresh process
            }
        }
    }

    let exe = resolve_model_runtime_exe(&app)?;
    let runtime_dir = exe
        .parent()
        .ok_or_else(|| "runtime directory not found".to_string())?;

    let mut command = Command::new(&exe);
    command
        .current_dir(runtime_dir)
        .args([
            "--model",
            &model_path,
            "--host",
            MODEL_HOST,
            "--port",
            MODEL_PORT,
            "--ctx-size",
            MODEL_CONTEXT,
            "--jinja",
        ])
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    #[cfg(target_os = "windows")]
    {
        command.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let child = command
        .spawn()
        .map_err(|e| format!("failed to start model runtime: {e}"))?;

    *guard = Some(child);
    Ok(())
}
```

Binding explicitly to `127.0.0.1` prevents the server from listening on the LAN.

`4096` context is deliberate. This app does not need Gemma 4's maximum context window.

## 22.5 Stop command

```rust
#[tauri::command]
pub fn stop_model_process(
    state: tauri::State<ModelProcessState>,
) -> Result<(), String> {
    let mut guard = state.child.lock().map_err(|_| "model lock poisoned")?;

    if let Some(child) = guard.as_mut() {
        let _ = child.kill();
        let _ = child.wait();
    }

    *guard = None;
    Ok(())
}
```

## 22.6 App setup and quit cleanup

```rust
pub fn run() {
    kill_stale_taskflow_llama();

    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .manage(ModelProcessState::default())
        .invoke_handler(tauri::generate_handler![
            start_model_process,
            stop_model_process,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Main window close hides to tray.
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Taskflow Local");
}
```

The tray Quit handler must call `stop_model_process` equivalent logic before `app.exit(0)`.

---

# 23. Health wait and “Starting…” state

Loading the model from disk may take noticeable time.

The UI must show a plain status:

```text
Starting…
```

Do not show fake token animations or AI visual effects.

## 23.1 Health poll

```ts
const MODEL_HEALTH_URL = 'http://127.0.0.1:39281/health';

export async function waitForModelReady(
  timeoutMs = 45_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(MODEL_HEALTH_URL, {
        method: 'GET',
        cache: 'no-store',
      });

      if (response.status === 200) {
        return;
      }

      // 503 means llama-server is alive but the model is loading.
    } catch {
      // Process may not have opened the port yet.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error('Local model did not start in time');
}
```

---

# 24. TypeScript model manager

```ts
import { invoke } from '@tauri-apps/api/core';
import { exists, mkdir } from '@tauri-apps/plugin-fs';

let state: ModelState = 'stopped';
let idleTimer: number | null = null;

export function getModelState(): ModelState {
  return state;
}

export async function ensureModelReady(): Promise<void> {
  if (state === 'ready') {
    touchModelActivity();
    return;
  }

  const modelPath = await getExpectedModelPath();

  if (!(await exists(modelPath))) {
    state = 'missing';
    throw new Error('MODEL_MISSING');
  }

  state = 'starting';

  try {
    await invoke('start_model_process', {
      modelPath,
    });

    await waitForModelReady();
    state = 'ready';
    touchModelActivity();
  } catch (error) {
    state = 'error';
    throw error;
  }
}

export async function stopModel(): Promise<void> {
  if (idleTimer !== null) {
    window.clearTimeout(idleTimer);
    idleTimer = null;
  }

  await invoke('stop_model_process');
  state = 'stopped';
}

export function touchModelActivity(): void {
  if (idleTimer !== null) {
    window.clearTimeout(idleTimer);
  }

  idleTimer = window.setTimeout(() => {
    void stopModel();
  }, MODEL_IDLE_MS);
}
```

If using `@tauri-apps/plugin-fs`, scope it only to the app-local models directory. Do not grant broad filesystem access just to test file existence.

---

# 25. Full interpretation flow

This is the heart of the app.

```ts
export type InteractionResult =
  | {
      kind: 'proposal';
      proposal: ApprovalProposal;
    }
  | {
      kind: 'query';
      tasks: Task[];
    }
  | {
      kind: 'clarify';
      question: string;
    };

export async function interpretUserRequest(
  userText: string,
): Promise<InteractionResult> {
  return withModelLock(async () => {
    const candidates = await getModelTaskContext(25);

    await ensureModelReady();

    const systemPrompt = buildSystemPrompt({
      now: new Date(),
      tasks: candidates,
    });

    const raw = await requestActionFromModel(userText, systemPrompt);
    const parsed = parseModelAction(raw);
    const action = validateModelAction(parsed, candidates);

    touchModelActivity();

    switch (action.action) {
      case 'query':
        return {
          kind: 'query',
          tasks: await executeModelQuery(action),
        };

      case 'clarify':
        return {
          kind: 'clarify',
          question: action.clarification_question!,
        };

      default:
        return {
          kind: 'proposal',
          proposal: buildApprovalProposal(action, candidates),
        };
    }
  });
}
```

No mutation occurs inside this function.

That is non-negotiable.

---

# 26. Queries are deterministic

The model only describes a query range/category.

SQLite returns the tasks.

The model never fabricates the answer list.

## 26.1 Query implementation

```ts
export async function executeModelQuery(
  action: ModelAction,
): Promise<Task[]> {
  const db = await getDb();

  switch (action.query_kind) {
    case 'range': {
      const start = localIsoToUtc(action.query_start_local!);
      const end = localIsoToUtc(action.query_end_local!);

      const rows = await db.select<TaskRow[]>(
        `SELECT *
         FROM tasks
         WHERE deleted_at_utc IS NULL
           AND scheduled_at_utc >= ?
           AND scheduled_at_utc <= ?
         ORDER BY scheduled_at_utc ASC`,
        [start, end],
      );

      return rows.map(mapTask);
    }

    case 'open': {
      const rows = await db.select<TaskRow[]>(
        `SELECT *
         FROM tasks
         WHERE deleted_at_utc IS NULL
           AND status != 'done'
         ORDER BY scheduled_at_utc ASC`
      );
      return rows.map(mapTask);
    }

    case 'unread': {
      const rows = await db.select<TaskRow[]>(
        `SELECT *
         FROM tasks
         WHERE deleted_at_utc IS NULL
           AND is_read = 0
         ORDER BY scheduled_at_utc ASC`
      );
      return rows.map(mapTask);
    }

    case 'done': {
      const rows = await db.select<TaskRow[]>(
        `SELECT *
         FROM tasks
         WHERE deleted_at_utc IS NULL
           AND status = 'done'
         ORDER BY scheduled_at_utc DESC
         LIMIT 50`
      );
      return rows.map(mapTask);
    }

    default:
      throw new Error('Unsupported query');
  }
}
```

For the demo, rendering the exact rows is enough. Do not send them back through Gemma for prose summarization unless there is ample time.

---

# 27. Approval proposals live only in memory

There is no `proposed_actions` table.

```ts
export type ApprovalProposal =
  | {
      kind: 'create';
      command: TaskCommand & { type: 'create' };
    }
  | {
      kind: 'update';
      task: Task;
      command: TaskCommand & { type: 'update' };
    }
  | {
      kind: 'delete';
      task: Task;
      command: TaskCommand & { type: 'delete' };
    }
  | {
      kind: 'set_status';
      task: Task;
      command: TaskCommand & { type: 'set_status' };
    }
  | {
      kind: 'set_read';
      task: Task;
      command: TaskCommand & { type: 'set_read' };
    };
```

## 27.1 Convert model action to command

```ts
export function buildApprovalProposal(
  action: ModelAction,
  candidates: Task[],
): ApprovalProposal {
  switch (action.action) {
    case 'create':
      return {
        kind: 'create',
        command: {
          type: 'create',
          payload: {
            title: action.title!.trim(),
            scheduledAtUtc: localIsoToUtc(action.scheduled_at_local!),
            durationMinutes: action.duration_minutes,
          },
        },
      };

    case 'update': {
      const task = assertTaskIdAllowed(action.task_id, candidates)!;

      return {
        kind: 'update',
        task,
        command: {
          type: 'update',
          taskId: task.id,
          payload: {
            ...(action.title !== null
              ? { title: action.title.trim() }
              : {}),
            ...(action.scheduled_at_local !== null
              ? {
                  scheduledAtUtc: localIsoToUtc(
                    action.scheduled_at_local,
                  ),
                }
              : {}),
            ...(action.duration_minutes !== null
              ? { durationMinutes: action.duration_minutes }
              : {}),
          },
        },
      };
    }

    case 'delete': {
      const task = assertTaskIdAllowed(action.task_id, candidates)!;
      return {
        kind: 'delete',
        task,
        command: {
          type: 'delete',
          taskId: task.id,
        },
      };
    }

    case 'set_status': {
      const task = assertTaskIdAllowed(action.task_id, candidates)!;
      return {
        kind: 'set_status',
        task,
        command: {
          type: 'set_status',
          taskId: task.id,
          status: action.status!,
        },
      };
    }

    case 'set_read': {
      const task = assertTaskIdAllowed(action.task_id, candidates)!;
      return {
        kind: 'set_read',
        task,
        command: {
          type: 'set_read',
          taskId: task.id,
          isRead: action.is_read!,
        },
      };
    }

    default:
      throw new Error('Action does not create a proposal');
  }
}
```

---

# 28. Approval card UI

Approval cards should look like Taskflow controls, not chat bubbles.

```tsx
interface ApprovalCardProps {
  proposal: ApprovalProposal;
  onCancel: () => void;
  onApplied: () => void;
}

export function ApprovalCard({
  proposal,
  onCancel,
  onApplied,
}: ApprovalCardProps) {
  const [applying, setApplying] = useState(false);

  async function apply() {
    if (applying) return;
    setApplying(true);

    try {
      await executeTaskCommand(proposal.command);
      onApplied();
    } finally {
      setApplying(false);
    }
  }

  return (
    <section className="approval-card tf-surface">
      <ApprovalSummary proposal={proposal} />

      <div className="approval-actions">
        <button
          className="tf-button"
          disabled={applying}
          onClick={onCancel}
        >
          Cancel
        </button>

        <button
          className="tf-button approval-primary"
          disabled={applying}
          onClick={() => void apply()}
        >
          {applying ? 'Applying…' : approvalVerb(proposal)}
        </button>
      </div>
    </section>
  );
}
```

## 28.1 Summary examples

Create:

```text
CREATE

Finish compiler assignment
Tomorrow · 20:00
120 min

[Cancel] [Create]
```

Update:

```text
CHANGE

Gym
08:00 → 09:00

[Cancel] [Change]
```

Status:

```text
STATUS

Send project files
To do → Done

[Cancel] [Apply]
```

Read state:

```text
READ STATE

Finish report
Unread → Read

[Cancel] [Apply]
```

Delete:

```text
DELETE

Dentist
7 Oct · 15:30

[Cancel] [Delete]
```

Always show the resolved time before approval.

That is the safety mechanism for date mistakes.

---

# 29. Manual editor

Manual use should be fully independent of the model.

For V1, one compact form is enough.

```tsx
interface ManualTaskDraft {
  title: string;
  localDateTime: string;
  durationMinutes: string;
}

export function ManualTaskEditor({
  onCreated,
}: {
  onCreated: () => void;
}) {
  const [draft, setDraft] = useState<ManualTaskDraft>({
    title: '',
    localDateTime: '',
    durationMinutes: '',
  });

  async function submit() {
    if (!draft.title.trim() || !draft.localDateTime) return;

    await executeTaskCommand({
      type: 'create',
      payload: {
        title: draft.title.trim(),
        scheduledAtUtc: localIsoToUtc(
          `${draft.localDateTime}:00`.slice(0, 19),
        ),
        durationMinutes: draft.durationMinutes
          ? Number(draft.durationMinutes)
          : null,
      },
    });

    setDraft({
      title: '',
      localDateTime: '',
      durationMinutes: '',
    });

    onCreated();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <input
        value={draft.title}
        onChange={(e) =>
          setDraft((d) => ({ ...d, title: e.target.value }))
        }
        placeholder="Task"
      />

      <input
        type="datetime-local"
        value={draft.localDateTime}
        onChange={(e) =>
          setDraft((d) => ({ ...d, localDateTime: e.target.value }))
        }
      />

      <input
        inputMode="numeric"
        value={draft.durationMinutes}
        onChange={(e) =>
          setDraft((d) => ({ ...d, durationMinutes: e.target.value }))
        }
        placeholder="Minutes"
      />

      <button className="tf-button" type="submit">
        Add
      </button>
    </form>
  );
}
```

---

# 30. Timeline mechanics

The timeline is sorted by scheduled time.

On open, place the nearest current/upcoming task near the upper-middle of the viewport.

Do not spend the deadline implementing complicated virtualization unless the app actually has enough tasks to need it.

## 30.1 Find current index

```ts
export function findNowIndex(tasks: Task[], now = Date.now()): number {
  const index = tasks.findIndex(
    (task) => new Date(task.scheduledAtUtc).getTime() >= now,
  );

  if (index >= 0) return index;
  return Math.max(0, tasks.length - 1);
}
```

## 30.2 Scroll once after load

```tsx
const rowRefs = useRef(new Map<string, HTMLDivElement>());
const didInitialScroll = useRef(false);

useEffect(() => {
  if (didInitialScroll.current || tasks.length === 0) return;

  const index = findNowIndex(tasks);
  const task = tasks[index];
  const element = rowRefs.current.get(task.id);

  if (element) {
    didInitialScroll.current = true;
    element.scrollIntoView({
      block: 'center',
      behavior: 'auto',
    });
  }
}, [tasks]);
```

Do not repeatedly yank the scroll position while the user is using the app.

---

# 31. Read/unread visual rule

Read/unread should be subtle.

Do not invent a messaging-style unread badge system.

Example:

```css
.task-row[data-read="false"] .task-title {
  font-weight: 800;
}

.task-row[data-read="true"] .task-title {
  font-weight: 600;
}
```

A small square/dot is acceptable if it matches Taskflow's existing visual language.

---

# 32. Status visual rule

Use the three V1 statuses:

```text
todo
in_progress
done
```

No extra workflow states.

Suggested mapping:

```ts
export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
};
```

Do not use “cancelled” as a status. Delete is represented by `deleted_at_utc`.

---

# 33. Missing model behavior

The app must not look broken when the model is absent.

Timeline and manual controls still work.

When the user first uses the composer:

```tsx
if (modelState === 'missing') {
  return (
    <div className="inline-notice tf-surface">
      <strong>Local model not found.</strong>
      <p>
        Place gemma-4-E2B_q4_0-it.gguf in the Models folder.
      </p>
      <button className="tf-button" onClick={openModelsFolder}>
        Open Models Folder
      </button>
    </div>
  );
}
```

No settings page is required for this.

---

# 34. Open Models Folder

Create the app-local model directory if missing, then open it.

Use Tauri's app-local-data path and an opener command/plugin.

Conceptual TypeScript:

```ts
import { mkdir } from '@tauri-apps/plugin-fs';
import { openPath } from '@tauri-apps/plugin-opener';

export async function openModelsFolder(): Promise<void> {
  const directory = await getModelDirectory();
  await mkdir(directory, { recursive: true });
  await openPath(directory);
}
```

If the installed opener plugin exposes a differently named API, use the pinned plugin's documented API. Do not write a custom Windows Explorer launcher unless necessary.

---

# 35. Tray behavior

Tray menu only needs:

```text
Open
Quit
```

Close button:

```text
hide main window
```

Quit:

```text
stop model process
exit app
```

No dynamic task label.

No task submenu.

No global shortcut.

No launch-at-login.

---

# 36. Model idle timeout

Production:

```text
30 minutes
```

Debug:

```text
60 seconds
```

Acceptance test:

1. Run in debug mode.
2. Send one request.
3. Confirm model process exists.
4. Wait slightly over 60 seconds.
5. Confirm process exits.
6. Send another request.
7. Confirm it starts again.

Do not wait 30 minutes during development.

---

# 37. Crash/orphan behavior

There are three cleanup paths:

1. normal app Quit -> kill child
2. idle timeout -> kill child
3. unexpected previous app crash -> next Taskflow launch kills stale `taskflow-llama.exe`

The renamed executable is important here.

Do not rely only on an in-memory child handle.

---

# 38. Phase 0 — blocking model smoke test

Do this before building the visual app.

## 38.1 Goal

Prove:

```text
exact llama.cpp Windows runtime
+
exact GGUF
+
4096 context
+
Gemma thinking disabled
+
JSON schema constrained output
=
reliable Taskflow action JSON
```

## 38.2 Manual command

From a PowerShell prompt inside the tested llama.cpp directory:

```powershell
.\llama-server.exe `
  --model "C:\path\to\gemma-4-E2B_q4_0-it.gguf" `
  --host 127.0.0.1 `
  --port 39281 `
  --ctx-size 4096 `
  --jinja
```

Then verify:

```powershell
curl.exe http://127.0.0.1:39281/health
```

Expected after loading:

```json
{"status":"ok"}
```

## 38.3 Test schema request

Use a small request first:

```powershell
$body = @'
{
  "model": "taskflow-local",
  "messages": [
    {
      "role": "system",
      "content": "Convert the user's task request to the required JSON object."
    },
    {
      "role": "user",
      "content": "Add gym tomorrow at 7 for one hour"
    }
  ],
  "temperature": 0,
  "max_tokens": 256,
  "stream": false,
  "chat_template_kwargs": {
    "enable_thinking": false
  },
  "response_format": {
    "type": "json_schema",
    "schema": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "action": {
          "type": "string",
          "enum": ["create", "clarify"]
        },
        "title": {
          "type": ["string", "null"]
        },
        "duration_minutes": {
          "type": ["integer", "null"]
        }
      },
      "required": ["action", "title", "duration_minutes"]
    }
  }
}
'@

Invoke-RestMethod `
  -Uri "http://127.0.0.1:39281/v1/chat/completions" `
  -Method Post `
  -ContentType "application/json" `
  -Body $body
```

If this exact shape fails against the pinned build, adapt to the pinned build once and freeze it.

## 38.4 Five smoke prompts

Do not move on until all five work well enough:

```text
Add gym tomorrow at 7 for one hour

I already sent the files

Move gym to 9 tomorrow

Mark the report unread

What do I have tonight?
```

Use a representative 25-task context for the last four.

## 38.5 Phase 0 pass condition

You are allowed to build the rest only when:

- exact runtime starts
- exact model loads
- `/health` reaches 200
- schema-constrained output is valid
- thinking output is absent
- create works
- existing-task ID selection works
- one date-relative example works
- installed runtime folder contents are known

---

# 39. Phase 1 — data + manual timeline

Build:

- Tauri shell
- React shell
- one SQLite table
- timeline
- manual create
- manual edit
- manual status change
- read/unread
- soft delete
- persistence after Quit/reopen

Do not integrate model UI beyond a placeholder composer yet.

Pass condition:

```text
create 3 tasks
quit
reopen
all 3 remain
edit 1
complete 1
mark 1 unread
soft-delete 1
```

---

# 40. Phase 2 — model process + one approval card

Build only:

- Rust model process start/stop
- stale-process cleanup
- health wait
- missing-model message
- one request lock
- one schema request
- create approval card
- approve -> same task service -> SQLite

Pass condition:

```text
Type: Add gym tomorrow at 7 for one hour
↓
Starting…
↓
Approval card appears
↓
Card shows resolved date, time, 60 minutes
↓
Approve
↓
Task appears in timeline
```

Do not proceed until this is reliable.

---

# 41. Phase 3 — remaining demo actions

Add:

- query
- update/reschedule
- delete
- set_status
- set_read
- clarify

Pass condition:

```text
Create -> approval -> works
Query -> no approval -> DB results shown
Move -> approval -> works
Done -> approval -> works
In progress -> approval -> works
Unread -> approval -> works
Delete -> approval -> works
Ambiguous request -> clarification instead of guess
```

At this point the demo path is complete.

---

# 42. Phase 4 — package before feature work

Build the NSIS installer now.

Do not postpone packaging until the final hour.

Test on an installed copy:

- app launches
- runtime resource folder exists
- DLLs load
- model process starts
- model path is resolved
- SQLite persists
- tray works
- Quit kills model process
- close hides window
- reopening from tray works

Expect Windows SmartScreen warning for an unsigned build.

README should say this clearly.

Example:

```md
## Windows warning

Taskflow Local is currently an unsigned Hacktoberfest challenge build.
Windows SmartScreen may show an "unrecognized app" warning.
If you downloaded the build from this repository's official release,
choose **More info → Run anyway** to continue.
```

---

# 43. Phase 5 — visual polish only

Only after installed-build acceptance passes:

- copy exact original Taskflow visual tokens
- tighten spacing
- add 120–180ms task insertion/removal transitions
- improve Now marker
- make approval card visually consistent
- test one non-English create
- record demo
- write challenge post

Do not add architecture.

---

# 44. Optional post-demo model downloader

This is explicitly **after** Phase 4.

The first deadline release may require manual model placement.

If there is time to implement automatic download, do it in Rust, streaming to disk.

Do not fetch 3.35 GB into JavaScript memory.

Do not hash a 3.35 GB `ArrayBuffer` in the WebView.

## 44.1 Required behavior

```text
GET remote file
↓
stream chunks
↓
write models/file.gguf.part
↓
update SHA-256 incrementally
↓
emit progress event
↓
finish
↓
compare digest
↓
rename .part to final filename
```

## 44.2 Rust downloader dependencies

Conceptually:

```toml
[dependencies]
reqwest = { version = "...", features = ["stream", "rustls-tls"] }
sha2 = "..."
futures-util = "..."
tokio = { version = "...", features = ["fs", "io-util"] }
```

Pin compatible versions when implementing.

## 44.3 Progress payload

```rust
#[derive(Clone, serde::Serialize)]
struct ModelDownloadProgress {
    downloaded: u64,
    total: Option<u64>,
    percent: Option<f64>,
}
```

## 44.4 Streaming sketch

```rust
use futures_util::StreamExt;
use sha2::{Digest, Sha256};
use tokio::fs::{self, File};
use tokio::io::AsyncWriteExt;
use tauri::Emitter;

const EXPECTED_SHA256: &str =
    "fa401b55b07ee70a54c6dae3903c783a6e65064312529ea57175cb5f8dec6634";

#[tauri::command]
async fn download_model(
    app: tauri::AppHandle,
    url: String,
    final_path: String,
) -> Result<(), String> {
    let part_path = format!("{final_path}.part");

    if let Some(parent) = std::path::Path::new(&part_path).parent() {
        fs::create_dir_all(parent)
            .await
            .map_err(|e| e.to_string())?;
    }

    let client = reqwest::Client::new();
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?;

    let total = response.content_length();
    let mut stream = response.bytes_stream();
    let mut file = File::create(&part_path)
        .await
        .map_err(|e| e.to_string())?;

    let mut hasher = Sha256::new();
    let mut downloaded = 0_u64;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;

        file.write_all(&chunk)
            .await
            .map_err(|e| e.to_string())?;

        hasher.update(&chunk);
        downloaded += chunk.len() as u64;

        let percent = total.map(|t| {
            if t == 0 {
                0.0
            } else {
                (downloaded as f64 / t as f64) * 100.0
            }
        });

        let _ = app.emit(
            "model-download-progress",
            ModelDownloadProgress {
                downloaded,
                total,
                percent,
            },
        );
    }

    file.flush().await.map_err(|e| e.to_string())?;
    drop(file);

    let digest = format!("{:x}", hasher.finalize());
    if digest != EXPECTED_SHA256 {
        let _ = fs::remove_file(&part_path).await;
        return Err(format!(
            "SHA-256 mismatch: expected {EXPECTED_SHA256}, got {digest}"
        ));
    }

    fs::rename(&part_path, &final_path)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}
```

If the remote host requires authentication in the future, do not rush auth into the deadline build. Fall back to manual placement.

---

# 45. Model download UI, only if Phase 4 is done

```tsx
interface DownloadProgress {
  downloaded: number;
  total: number | null;
  percent: number | null;
}

export function ModelDownloadProgress({
  progress,
}: {
  progress: DownloadProgress;
}) {
  const label = progress.percent === null
    ? `${formatBytes(progress.downloaded)} downloaded`
    : `${progress.percent.toFixed(1)}%`;

  return (
    <section className="tf-surface model-download">
      <strong>Downloading local model</strong>
      <div>{label}</div>
      {progress.percent !== null && (
        <progress max={100} value={progress.percent} />
      )}
    </section>
  );
}
```

Again: not a blocker for submission.

---

# 46. Failure states

Keep failure handling short and useful.

## 46.1 Model missing

```text
Local model not found.
[Open Models Folder]
```

## 46.2 Model starting

```text
Starting…
```

## 46.3 Model start failure

```text
Could not start the local model.
Manual task controls still work.
[Try Again]
```

## 46.4 Invalid model response

```text
I couldn't interpret that safely.
Try saying it another way.
```

Do not show raw JSON unless dev mode is enabled.

## 46.5 Ambiguous task

Use clarification:

```text
Which meeting do you mean?

• Team meeting — 10:00
• Project meeting — 16:00
```

For the deadline, this can be a simple card with buttons rather than another free-form model round trip.

---

# 47. Clarification without an agent loop

If the model returns `clarify`, show its question.

If ambiguity specifically concerns multiple candidate tasks, the app can show buttons directly.

```ts
export function formatTaskTime(task: Task): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(task.scheduledAtUtc));
}

export interface ClarificationChoice {
  taskId: string;
  label: string;
}

export function buildTaskChoices(tasks: Task[]): ClarificationChoice[] {
  return tasks.map((task) => ({
    taskId: task.id,
    label: `${task.title} — ${formatTaskTime(task)}`,
  }));
}
```

Do not build a general multi-turn planning engine.

A follow-up user message simply triggers a new single model request with the latest task context.

---

# 48. No persisted chat history

Conversation state exists only in React memory.

You may keep a few visible rows for the current window session:

```ts
export type ComposerItem =
  | { id: string; type: 'user'; text: string }
  | { id: string; type: 'proposal'; proposal: ApprovalProposal }
  | { id: string; type: 'query'; tasks: Task[] }
  | { id: string; type: 'clarify'; text: string }
  | { id: string; type: 'status'; text: string };
```

After app restart, chat history disappears.

That is acceptable.

Tasks do not disappear.

---

# 49. State store

Do not introduce Redux unless already present and unavoidable.

A small React hook is sufficient.

```ts
export function useTaskflow() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [composerItems, setComposerItems] = useState<ComposerItem[]>([]);
  const [modelState, setModelState] = useState<ModelState>('stopped');

  const refreshTasks = useCallback(async () => {
    setTasks(await listTimelineTasks());
  }, []);

  useEffect(() => {
    void refreshTasks();
  }, [refreshTasks]);

  return {
    tasks,
    composerItems,
    modelState,
    setComposerItems,
    setModelState,
    refreshTasks,
  };
}
```

---

# 50. Performance rules

Do not advertise RAM numbers you have not measured.

Instead implement behaviors that reduce RAM:

- model not loaded at app startup
- 4096 token context
- maximum 25 task candidates
- no persisted conversation context injected into every prompt
- one request at a time
- `max_tokens` around 256 for action extraction
- thinking disabled
- model stopped after 30 minutes idle
- no embeddings
- no vector DB
- no second model
- no multimodal projector

After the deadline, measure real idle and loaded RAM on the target machine and publish observed numbers only.

---

# 51. Security boundaries

The local model server must bind to:

```text
127.0.0.1
```

not:

```text
0.0.0.0
```

The model never receives:

- direct SQL access
- arbitrary filesystem access
- shell access
- generic tools
- a delete command that bypasses approval

The model receives only:

- current local date/time
- the 14-day date table
- up to 25 relevant tasks
- the user's request
- the schema and rules

The UI receives the proposed action.

Only Taskflow's TypeScript task service mutates SQLite.

---

# 52. Manual and model flow equivalence

Manual completion:

```text
click Done
  ↓
executeTaskCommand({ type: 'set_status', ... })
  ↓
SQLite
```

Conversational completion:

```text
"I already sent the files"
  ↓
Gemma returns set_status + task_id
  ↓
approval card
  ↓
user approves
  ↓
executeTaskCommand({ type: 'set_status', ... })
  ↓
SQLite
```

There is no separate model mutation system.

---

# 53. Example end-to-end create

User:

```text
Add gym tomorrow at 7 for one hour
```

Model receives:

```text
CURRENT LOCAL TIME
2026-10-04T00:07:00
Weekday: Sunday

NEXT 14 DAYS
0: Sunday, October 4, 2026 => 2026-10-04
1: Monday, October 5, 2026 => 2026-10-05
...

AVAILABLE TASKS
...
```

Model returns:

```json
{
  "action": "create",
  "task_id": null,
  "title": "Gym",
  "scheduled_at_local": "2026-10-05T07:00:00",
  "duration_minutes": 60,
  "status": null,
  "is_read": null,
  "query_kind": null,
  "query_start_local": null,
  "query_end_local": null,
  "clarification_question": null
}
```

App validates.

App shows:

```text
CREATE

Gym
Mon, 5 Oct · 07:00
60 min

[Cancel] [Create]
```

Only after Create:

```ts
await executeTaskCommand({
  type: 'create',
  payload: {
    title: 'Gym',
    scheduledAtUtc: localIsoToUtc('2026-10-05T07:00:00'),
    durationMinutes: 60,
  },
});
```

---

# 54. Example end-to-end semantic status match

Database contains:

```text
id=8c... title="Send project files to Srini"
```

User:

```text
I already sent the files
```

Because that task appears in the 25-task context, the model can return:

```json
{
  "action": "set_status",
  "task_id": "8c...",
  "title": null,
  "scheduled_at_local": null,
  "duration_minutes": null,
  "status": "done",
  "is_read": null,
  "query_kind": null,
  "query_start_local": null,
  "query_end_local": null,
  "clarification_question": null
}
```

App validates that `8c...` is actually one of the provided candidates.

Then approval card.

This is more reliable than asking SQLite to `LIKE '%sent the files%'` against the title.

---

# 55. Example end-to-end query

User:

```text
What do I have tonight?
```

Model returns:

```json
{
  "action": "query",
  "task_id": null,
  "title": null,
  "scheduled_at_local": null,
  "duration_minutes": null,
  "status": null,
  "is_read": null,
  "query_kind": "range",
  "query_start_local": "2026-10-04T17:00:00",
  "query_end_local": "2026-10-04T23:59:59",
  "clarification_question": null
}
```

Taskflow executes SQL and renders the actual tasks.

No approval is required because nothing changes.

---

# 56. Example multilingual create

This is a bonus test, not a blocker.

User may type in a supported non-English language.

The model can return the same schema while preserving task title language.

Example:

```json
{
  "action": "create",
  "task_id": null,
  "title": "அம்மாவை அழைக்கவும்",
  "scheduled_at_local": "2026-10-05T20:00:00",
  "duration_minutes": null,
  "status": null,
  "is_read": null,
  "query_kind": null,
  "query_start_local": null,
  "query_end_local": null,
  "clarification_question": null
}
```

Do not claim uniform quality across all languages unless tested.

Product copy can still say:

```text
Add tasks in your language.
```

Avoid hard benchmark claims.

---

# 57. README install section

Deadline-friendly README:

```md
## Run Taskflow Local

1. Install Taskflow Local from the Windows installer.
2. Open the app.
3. Manual task management works immediately.
4. For natural-language controls, place this model file in Taskflow Local's Models folder:

   `gemma-4-E2B_q4_0-it.gguf`

5. In Taskflow Local, use **Open Models Folder** to open the correct location.
6. Restart is not required. Send a request and Taskflow will start the local model on demand.

The model is unloaded after 30 minutes without model requests.

## Windows SmartScreen

This challenge build is unsigned, so Windows may show a SmartScreen warning.
If you downloaded the installer from this repository's official release,
choose **More info → Run anyway**.
```

Do not make the README tell the friend to install Rust, Python, Node, or Ollama.

---

# 58. Demo video

Keep the demo tight.

Suggested sequence:

1. Launch Taskflow Local.
2. Show the timeline centered around Now.
3. Manually add one task.
4. Mark it in progress or done.
5. Type: `Add gym tomorrow at 7 for one hour.`
6. Show `Starting…` briefly if this is the first request.
7. Show the approval card.
8. Approve it.
9. Show the new task in the timeline.
10. Type: `Move gym to 9.`
11. Show and approve the time change.
12. Type: `Mark gym unread.`
13. Approve.
14. Type: `What do I have tomorrow?`
15. Show deterministic task results.
16. Type: `Delete gym.`
17. Approve.
18. Quit Taskflow completely.
19. Reopen Taskflow.
20. Show remaining tasks still present.

Optional bonus if stable:

21. Create one task in another language.

Do not spend video time discussing:

- context windows
- quantization
- model unload timers
- sidecar process architecture
- JSON schema implementation
- Rust
- SQLite internals

Those belong in the write-up.

---

# 59. User-facing feature language

Use plain language.

Good:

```text
Works offline
Tasks stay on your computer
No account
Survives restarts
Add tasks in your language
Ask what is next
Move or complete tasks by typing normally
Nothing changes until you approve it
Lives in your taskbar
Quit when you want
```

Avoid:

```text
AI-powered
agentic
LLM
copilot
RAG
local inference
function calling
reasoning model
```

Those terms may appear in the technical write-up, not the product UI.

---

# 60. Acceptance checklist

## Phase 0

- [ ] Exact chosen llama.cpp Windows runtime downloaded.
- [ ] Exact runtime version/tag/build recorded.
- [ ] Entire runtime folder contents preserved.
- [ ] Exact `gemma-4-E2B_q4_0-it.gguf` exists locally.
- [ ] Private-window Hugging Face download check performed.
- [ ] `llama-server` starts with that model.
- [ ] Server binds to `127.0.0.1`.
- [ ] Context size is 4096.
- [ ] `/health` reaches 200.
- [ ] Schema-constrained JSON works.
- [ ] `enable_thinking=false` works for the pinned build.
- [ ] Five representative prompts tested.

## Data/manual

- [ ] One `tasks` table only.
- [ ] `duration_minutes` exists.
- [ ] `due_at` does not exist.
- [ ] `status` supports `todo`, `in_progress`, `done`.
- [ ] `is_read` exists and works.
- [ ] Soft delete works.
- [ ] Timeline sorts by scheduled time.
- [ ] Timeline opens near Now.
- [ ] Manual create works.
- [ ] Manual edit works.
- [ ] Manual set status works.
- [ ] Manual read/unread works.
- [ ] Manual delete works.
- [ ] Quit + reopen preserves tasks.

## Conversational control

- [ ] Maximum 25 relevant tasks passed to the model.
- [ ] Next 14 days with weekdays/dates passed to the model.
- [ ] Existing-task actions return an ID from supplied context.
- [ ] Returned IDs are validated.
- [ ] LIKE lookup is fallback only.
- [ ] One JSON schema handles all actions.
- [ ] One request at a time.
- [ ] Send button disabled while running.
- [ ] Create requires approval.
- [ ] Update requires approval.
- [ ] Delete requires approval.
- [ ] Status changes require approval.
- [ ] Read/unread changes require approval.
- [ ] Query does not require approval.
- [ ] Clarify does not mutate data.

## Model lifecycle

- [ ] Model is not started at app launch.
- [ ] Manual task manager works with model stopped.
- [ ] Missing model shows Models-folder action.
- [ ] First request shows `Starting…`.
- [ ] Model starts on demand.
- [ ] Idle timeout is 60 seconds in debug.
- [ ] Idle timeout is 30 minutes in production.
- [ ] Model stops after debug idle timeout.
- [ ] Next request restarts it.
- [ ] App Quit kills model process.
- [ ] App startup kills stale `taskflow-llama.exe`.

## Packaging

- [ ] Bundled process renamed `taskflow-llama.exe`.
- [ ] Required DLLs/resources ship beside it in the runtime resource directory.
- [ ] Installed app tested, not only dev mode.
- [ ] Installed app can start model.
- [ ] Installed app can access SQLite.
- [ ] Installed app can persist tasks.
- [ ] Tray has Open and Quit.
- [ ] Close hides to tray.
- [ ] Quit actually exits.
- [ ] README documents SmartScreen warning.

## Design

- [ ] Original Taskflow design tokens manually extracted.
- [ ] No old Taskflow business/component implementation copied beyond visual tokens.
- [ ] Neobrutalist border/shadow language retained.
- [ ] Main layout is smaller than original Taskflow.
- [ ] No gradients.
- [ ] No glass.
- [ ] No AI branding.
- [ ] Timeline dominates the window.
- [ ] Composer is secondary.
- [ ] Animations are short and functional.

---

# 61. Definition of done

The deadline build is done when this exact sequence works in the **installed Windows build**:

```text
Open app
↓
Timeline loads from SQLite
↓
Manual task can be created
↓
Manual task can be completed
↓
Natural-language request starts local model
↓
Model returns constrained JSON
↓
Taskflow creates an approval card
↓
No DB write occurs before approval
↓
Approve writes through TaskCommand service
↓
Query returns actual DB rows
↓
Update works with approval
↓
Status works with approval
↓
Read/unread works with approval
↓
Delete works with approval
↓
Quit kills app + model
↓
Reopen
↓
Tasks remain
```

If that sequence works, stop adding features and submit.

---

# 62. Compact implementation order

Use this order, exactly:

```text
0. Prove exact Gemma + exact llama.cpp + schema JSON.
1. Create Tauri shell.
2. Add one SQLite tasks table.
3. Build chronological timeline.
4. Build manual create/edit/status/read/delete.
5. Test quit/reopen persistence.
6. Bundle tested llama.cpp runtime folder including DLLs.
7. Add Rust start/stop/stale-process cleanup.
8. Add model missing / Starting… UI.
9. Add 25-task context and 14-day date table.
10. Add one schema-constrained model request.
11. Add create approval card.
12. Add query.
13. Add update.
14. Add set_status.
15. Add set_read.
16. Add delete.
17. Add clarify.
18. Build NSIS installer.
19. Test installed build.
20. Copy exact original Taskflow design tokens and polish.
21. Record demo.
22. Write submission.
23. Only then consider downloader.
```

---

# 63. Final architectural diagram

```text
                         TASKFLOW LOCAL

┌───────────────────────────────────────────────────────────┐
│ React / TypeScript                                       │
│                                                           │
│  Timeline     Manual editor      "Tell Taskflow..."       │
│      │              │                    │                 │
│      │              │                    ▼                 │
│      │              │          modelService.ts             │
│      │              │                    │                 │
│      │              │          build prompt/context        │
│      │              │          - current time              │
│      │              │          - next 14 days              │
│      │              │          - 25 nearby tasks           │
│      │              │                    │                 │
│      │              │                    ▼                 │
│      │              │             llama-server             │
│      │              │             127.0.0.1                │
│      │              │             ctx 4096                 │
│      │              │             thinking off             │
│      │              │             JSON schema              │
│      │              │                    │                 │
│      │              │                    ▼                 │
│      │              │              ModelAction             │
│      │              │                    │                 │
│      │              │          validate task_id/date       │
│      │              │                    │                 │
│      │              │          ┌─────────┴─────────┐       │
│      │              │          │                   │       │
│      │              │        query              mutation    │
│      │              │          │                   │       │
│      │              │        SQLite          approval card  │
│      │              │                              │       │
│      │              │                         user approves  │
│      │              │                              │       │
│      └──────────────┴──────────────────────────────┘       │
│                             │                              │
│                             ▼                              │
│                      TaskCommand service                   │
│                             │                              │
│                             ▼                              │
│                    SQLite: tasks only                      │
└───────────────────────────────────────────────────────────┘

Rust/Tauri native layer:

┌───────────────────────────────────────────────────────────┐
│ tray: Open / Quit                                         │
│ hide window on close                                      │
│ spawn taskflow-llama.exe                                  │
│ stop taskflow-llama.exe                                   │
│ kill stale taskflow-llama.exe on startup                  │
│ optional post-deadline streaming model download           │
└───────────────────────────────────────────────────────────┘
```

The core design principle remains:

> **Taskflow Local is a persistent desktop task manager first. Natural-language control is another way to operate the same tasks.**

