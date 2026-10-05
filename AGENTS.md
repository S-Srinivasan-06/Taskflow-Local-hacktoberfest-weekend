# AGENTS.md — Taskflow Local

Instructions for Codex working in this repo. Keep this file under 32 KiB. Deeper `AGENTS.md` files (for example `src-tauri/AGENTS.md`) override this one for their folder.

## What this is

A Windows desktop task manager built for one real friend. Tasks sit on a time-ordered list. The user can also type plain language ("move gym to 9") and a local model turns it into a proposed change. Nothing the model proposes is applied until the user approves it.

- Task manager first. The language input is a second way to operate the same tasks.
- Everything is local: SQLite on disk, local model, no account, no cloud, no telemetry.
- Deadline build: **Oct 5, 2026, 06:59 UTC (14:59 SGT)**. If a feature is not in the demo path, do not build it.

## How to work here (Codex)

- Plan briefly, then make small, focused diffs. One concern per task.
- Search with `rg`. Read a file before editing it.
- Do not install new dependencies, change toolchain versions, or touch lockfiles without being asked.
- Do not commit, amend, rebase, or push unless asked. Leave changes in the working tree.
- Your sandbox is likely not Windows and may have no network. So:
  - Never download the model or the runtime. Never try to start the real model.
  - Test model code against a mocked `llamaClient` and fixture JSON.
  - You cannot build or verify the NSIS installer, tray, or the packaged runtime. Do not claim you did. List them under "Not verified" in your final message.
- Do not edit: `src-tauri/runtime/llama/**`, `models/**`, `*.gguf`, generated files, or lockfiles. Do not commit model files; keep them in `.gitignore`.
- Run before finishing, when the scripts exist: `npm run typecheck`, `npm test`, and `cargo check` in `src-tauri`.
- Final message format: what changed, files touched, checks run with results, and what could not be verified.

## Hard rules (never break)

1. **One write path.** Every task change, manual or approved from chat, goes through `executeTaskCommand()` in `src/domain/taskService.ts`. Nothing else writes to SQLite.
2. **The model never writes.** It returns one JSON action. The app validates it, shows an approval card, and only on Approve calls `executeTaskCommand()`. Queries need no approval; every other action does.
3. **SQLite is the source of truth.** Query answers come from SQL rows, never from model text.
4. **Manual use works with the model off.** App start never loads or waits for the model.
5. **No arbitrary SQL, shell, or file access for the model.** It only receives the prompt and returns JSON.
6. **The model server binds to `127.0.0.1` only.**
7. **No mutation inside `interpretUserRequest()`.** It returns a proposal, query result, or clarification.
8. **Do not copy code from the original Taskflow repo.** Only design values (colors, font, border, radius, shadow offsets) go into `src/styles/tokens.css`.

## Stack

Tauri 2, React, TypeScript, Vite, `@tauri-apps/plugin-sql` (SQLite), llama.cpp `llama-server` as a bundled runtime, and one small quantized text model in GGUF format.

Do not add: Node/Python/Java servers, Docker, Postgres, Ollama, Redux, LangChain/LangGraph, embeddings, vector stores, MCP, auth, cloud sync.

TypeScript owns almost all logic. Rust stays thin and only does:
- single-instance, tray (Open, Quit), hide-on-close
- start/stop the model process, kill stale `taskflow-llama.exe` on startup
- (optional, last) streaming model download with SHA-256 check

## Repo layout

```
src/
  app/            App.tsx, bootstrap.ts
  assets/         Original logo and application symbol
  components/     timeline/, composer/, task/, common/
  db/             database.ts, taskRepository.ts
  domain/         task.ts, actions.ts, taskService.ts
  model/          modelConfig.ts, actionSchema.ts, context.ts, prompt.ts,
                  llamaClient.ts, modelService.ts
  state/          useTaskflow.ts
  styles/         tokens.css, globals.css
src-tauri/
  src/            lib.rs, model_process.rs
  runtime/llama/  taskflow-llama.exe + every DLL from the tested build
tests/
  unit/           Automated date, domain, persistence and model-contract tests
  browser/        Mocked desktop page, fixtures and browser assertions
  artifacts/      Local check output; ignored by Git
scripts/          Browser runner and human-run model smoke checks
docs/             Usage, development, challenge notes, releases and evidence
```

Do not create folders for things that do not exist yet.

## Commands

Add missing scripts to `package.json` rather than inventing new tooling.

```
npm install
npm run tauri dev        # dev (model idle timeout = 60 s)
npm run tauri build      # NSIS installer (Windows only)
npm run typecheck        # tsc --noEmit
npm test                 # unit tests: dates, validation, task reference mapping
```

## Data model

One table, `tasks`. No events, messages, proposals, or reminders tables.

Columns: `id` (UUID), `title`, `scheduled_at_utc` (NOT NULL), `duration_minutes`, `status` (`todo|in_progress|done`), `is_read` (0/1), `reminder_at_utc`, `created_at_utc`, `updated_at_utc`, `deleted_at_utc`.

- Delete is soft: set `deleted_at_utc`. Normal queries filter `deleted_at_utc IS NULL`.
- No `due_at`. No `cancelled` status.
- Store UTC. The model returns local ISO without offset (`YYYY-MM-DDTHH:mm:ss`); the app validates and converts.
- Undo is a single in-memory callback. Cut it before adding an event log.
- Chat history is in React memory only.

## Model contract

One request in, one JSON object out. No tool loop, no agent framework.

Actions: `create`, `update`, `delete`, `set_status`, `set_read`, `query`, `clarify`.
Query kinds: `range`, `open`, `unread`, `done`, `next`.

Request rules for `llama-server`:
- `response_format: { type: "json_schema", schema }` on every call
- `chat_template_kwargs: { enable_thinking: false }`
- `temperature: 0`, `max_tokens: 256`
- start args: `--host 127.0.0.1 --ctx-size 4096 --parallel 1 --jinja`
- pin the exact llama.cpp build and exact model file after Phase 0 passes; do not upgrade afterwards
- the model filename and SHA-256 live in one place, `src/model/modelConfig.ts`. Do not hardcode them elsewhere and do not put a model name in UI text.

Prompt rules:
- Order matters for prompt caching: **static rules and examples first, then the 14-day date table, then the task list, then the current local time last**, then the user text.
- Date table text uses `en-US` formatting, not the system locale.
- Send at most ~25 nearby tasks (fewer if the prompt exceeds ~3000 tokens). Number them `1..N`; the model returns the number and code maps it back to the task id. Build the schema per request so the number is limited to the valid range. Never send UUIDs to the model.
- Examples are generated at runtime with real dates. No placeholder strings in examples.
- Keep task titles in the user's language.
- Title search (`LIKE`) is a fallback only.
- If two tasks plausibly match, return `clarify` and show buttons. Never guess for delete or update.
- A create without a time becomes a "When?" clarification, not an error.

Validation after every response: parse with Zod, check the task reference, check date format and validity, check required fields per action. On failure, retry once with a short correction, then show "I couldn't interpret that safely. Try saying it another way." Never show raw JSON outside dev mode.

One model request at a time (service lock plus disabled Send button).

## Model lifecycle

- States: `missing | stopped | starting | ready | error`.
- Start on first request. Poll `/health` (503 while loading, 200 when ready); timeout ~120 s. Also detect early process exit so a bad runtime fails fast.
- If a request fails because the process died, mark stopped and retry once with a restart.
- Idle timeout: 30 min in production, 60 s when `import.meta.env.DEV`. Reset after every request. Unload kills the process; the app and DB stay up.
- Quit: stop the model, then exit. Startup: kill stale `taskflow-llama.exe` (renamed binary, so we never kill someone else's `llama-server.exe`). Register single-instance first so a second launch exits before cleanup runs.
- Missing model: show "Local model not found" and an Open Models Folder button. Path is Tauri `appLocalDataDir()` + `models/` + the filename from `modelConfig.ts`.
- Do not bundle the model in the installer. Do not download it into JS memory or hash it in the WebView.

## Windows packaging

- Target: NSIS only.
- Bundle the whole `runtime/llama/` folder as Tauri resources (exe plus all DLLs). The exe is renamed `taskflow-llama.exe`.
- If the resolved resource path has a `\\?\` prefix, strip it before using it as a working directory.
- These must be checked by a human on an installed build: model starts, SQLite persists, tray works, Quit kills the model process.
- Unsigned build: README must mention the SmartScreen warning.

## UI and design

Same visual family as original Taskflow, compressed: hard borders, hard offset shadows, flat colors, high contrast, rectangular controls. All values come from `tokens.css`.

Never: gradients, glass blur, glow, animated orbs, sparkle or robot icons, assistant avatars, large chat bubbles, purple "AI" colors.

- Timeline is the product. Past above a NOW marker, future below. On open, scroll once to the next upcoming task and do not move scroll again.
- Next task gets a stronger border or left rule, not a hero card.
- Composer is one line at the bottom: "Tell Taskflow something…". Approval cards look like Taskflow controls, not chat bubbles, and always show the resolved date and time.
- Motion: 120–180 ms, `transform` and `opacity`, respect `prefers-reduced-motion`.
- Read/unread is subtle (title weight or a small dot).

## Copy rules

Plain words. Use: "Works offline", "Tasks stay on your computer", "No account", "Nothing changes until you approve it".
Do not use in the UI: AI-powered, agent, copilot, LLM, RAG, inference, "Ask AI", or any model name.

## Build order (do not skip ahead)

0. **Phase 0 gate (human, on the dev machine):** exact llama.cpp build + exact model file + schema JSON + thinking off + five test prompts + a full 25-task context. Confirm the model file downloads in a private browser window without login. Codex work before this passes is limited to non-model code and mocks.
1. Tauri shell, SQLite, timeline, manual create/edit/status/read/delete, quit-and-reopen persistence.
2. Bundle runtime, Rust start/stop/stale cleanup, single-instance, "Starting…" and missing-model states, one create approval card.
3. Remaining actions: query, update, set_status, set_read, delete, clarify.
4. NSIS installer and installed-build test.
5. Design tokens and polish, one non-English create (bonus), demo video, submission.
6. Only then: streaming downloader, reminders.

When behind schedule, cut in this order: reminders, undo, animation polish, non-English demo, close-to-tray. Never cut persistence, manual controls, approval before model writes, or the packaged installer.

## Out of scope for this build

Accounts, sync, REST API, MCP, plugins, embeddings, RAG, voice, model picker, backups, launch at login, global shortcuts, window-state persistence, recurrence, projects, labels, kanban, calendar view, bulk changes, attachments, persisted chat, event log, dynamic tray text. Reject changes that add these.

## Definition of done

In the **installed** Windows build:

1. Open app; timeline loads from SQLite; model process is not running.
2. Add and complete a task manually.
3. Type a request; model starts; approval card appears; no DB write before Approve.
4. Create, update, delete, status change, read/unread all work through approval cards.
5. Query returns real DB rows without an approval step.
6. An ambiguous reference asks which task.
7. Idle timeout unloads the model (60 s in dev) and the next request restarts it.
8. Quit kills the app and the model process.
9. Reopen: all tasks are unchanged.

Codex can cover items by unit tests and mocks. Items 1, 3, 7, 8, 9 need a human on Windows.

## Other rules

- Do not log task text or prompts in production builds.
- Do not claim a RAM or speed number unless measured on the demo machine.
- Prefer deleting scope to adding it. Ask before adding a dependency.
