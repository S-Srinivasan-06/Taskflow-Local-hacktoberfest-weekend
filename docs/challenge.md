# Hacktoberfest build notes

[Back to the README](../README.md) · [Developer guide](development.md)

## Why Taskflow Local exists

A friend saw my Taskflow web application and wanted the same idea on their own PC, with language controls to make it easier to use. Taskflow Local turns that request into a Windows desktop application: open a timeline, add or edit tasks directly, or type what you want to change.

The goal is practical accessibility through a second input method, without requiring an account, a hosted service, or a subscription. The timeline remains usable when the model is absent or unloaded. This is a new desktop implementation inspired by the earlier app's visual style; it does not reuse the earlier app's task-management components or business logic.

The request was specific: keep the familiar task list on the local PC and make everyday operations easier through language. A person should be able to write “move reading to 9 tomorrow,” see the exact date and time that means, and decide whether to save it. They should also be able to ignore the language input and edit the same task directly. Screenshot input extends this idea to an appointment or task already written in an image.

For example, an appointment screenshot currently requires the person to read it, remember its details, open a form, and re-enter the information. Taskflow can turn that image into a draft task locally. Moving an existing task can similarly begin with a sentence rather than a sequence of form edits. The review step remains visible because saving the wrong time would defeat the purpose of making task management easier. These are the intended benefits of the design; they have not been measured in a user study.

That shaped the product: the timeline takes priority, the language feature starts only when needed, and the model proposes changes instead of controlling storage. The app also follows familiar desktop behavior: closing its window leaves it in the tray, while an explicit Quit ends the session. The friend's identity is private. No friend testimonial, measured accessibility improvement, or completed handover is being claimed here.

## What was built during the challenge window

The challenge runs from **October 2, 2026, 02:00 UTC** to **October 5, 2026, 06:59 UTC**. This snapshot documents work completed by **October 4, 2026**, before the deadline:

- A Windows Tauri application with a visible window, system tray, close-to-tray, Open/Quit, and single-instance restoration.
- A SQLite timeline with manual create/edit, status, read/unread, and soft delete.
- Local Gemma integration for create, query, update, delete, status, read/unread, and clarification.
- Strict action validation, approval cards, and one shared task-writing path.
- On-demand model startup, health checks, early-exit detection, restart retry, idle unloading, and shutdown cleanup.
- A production EXE and an NSIS installer containing the pinned llama.cpp runtime and DLLs.
- Unit tests, mocked browser checks, real-model contract tests, and project documentation.
- An October 4 update added desktop reminders, five colour schemes, compact task rows, search/filter controls, keyboard shortcuts, local model selection, optional Ollama support, and screenshot-to-task proposals. This update is also before the deadline.

The installed-build acceptance check is still outstanding. There was no prior Git history in the local project before its initial commit, so this is a snapshot of the challenge work, not a reconstructed day-by-day commit history.

## Hacktoberfest submission context

The [official challenge](https://dev.to/challenges/hacktoberfest-weekend-2026-10-01) asks for a new project built during its window, the real person's problem, a demo, the build process, and an explanation of open innovation. This README supplies the project story, screenshots, downloadable app, architecture, and evidence for that write-up. The original web Taskflow is credited as inspiration; this repository contains the new desktop implementation.

| Submission topic | Project material |
| --- | --- |
| What was built and who it helps | The private friend's request for a local desktop version with easier language-based task operations |
| Demo | Windows release, synthetic UI screenshots, a real-model image result, and the reproducible walkthrough above |
| Code | This repository, source-linked architecture, and release tag |
| Build process | Manual-first SQLite implementation, bounded model actions, native lifecycle, reminders, and two source-review passes |
| Why open innovation matters | Downloadable weights, inspectable runtime, offline operation, local task context, and the ability to select another compatible model |
| Partner technology | Gemma supplies the text and image interpretation; llama.cpp runs it locally |

The most important connection to the theme is the original request: retain the familiar task-management idea on the friend's own PC and add a more accessible way to operate it. The extra controls support that request. The README does not claim that the friend has already accepted every feature or that the app has passed accessibility certification.

**Prize category: Best Use of Gemma.** The pinned Gemma weights power both structured task interpretation and the recorded screenshot example locally. No fine-tuning, hosted Gemma endpoint, or trained custom model is claimed.

Publishing this repository and release does not itself submit an entry on DEV. The DEV post uses the challenge's submission template with `devchallenge`, `weekendchallenge`, and `hf26challenge` tags. A session transcript is optional. Friend feedback should only be added after an actual handover; no testimonial has been invented for this README.

## Deliberately cut from V1

To keep the challenge focused: automatic model download, undo/event log, recurrence, projects/labels/kanban, bulk edits, persisted attachments, voice, cloud sync/accounts, Windows Calendar integration, launch at login, global shortcuts, and persisted chat. Reminders, local model selection, and temporary screenshot input were added in the October 4 update.

## Future work

First finish the installed Windows acceptance pass, including reminders, and gather feedback from the person using it. Then improve screen-reader usability, test non-English commands and a real Ollama provider, and check more screenshot formats and layouts. A streaming model downloader with SHA-256 validation is a possible later improvement.

## Attribution and licenses

- **Original project code:** no license has been granted yet. Public source availability alone does not grant reuse rights. No MIT or Apache license is being assigned to Taskflow Local in this snapshot.
- **Design inspiration and logo:** the author's earlier [Taskflow web application](https://github.com/S-Srinivasan-06/Taskflow). Literal visual values—colors, font choices, border, radius, and shadow offsets—were carried into `src/styles/tokens.css`; earlier components/business logic were not copied. At the author's request, the original SVG artwork from `frontend/src/assets/logo.svg` is preserved in `src/assets/taskflow-logo.svg`. A square crop of its checkmark symbol, with the invisible wordmark/filter removed, supplies the header, favicon, Windows app and tray icons. Logo reuse was added after the deadline on October 5. Search, filters, and keyboard shortcuts were implemented independently for this desktop app.
- **Model:** Google's pinned Gemma GGUF [model card](https://huggingface.co/google/gemma-4-E2B-it-qat-q4_0-gguf/blob/675cff42a74c774d6cb76f76d8eacb49b48c9b93/README.md) declares **Apache-2.0**. The weights are a separate upstream artifact and are not licensed by this repository.
- **Image projector:** a separate artifact from the same pinned Google model repository and license; it is not bundled with the app.
- **Additional palettes:** [Nord](https://www.nordtheme.com/docs/colors-and-palettes/) and [Dracula](https://draculatheme.com/contribute) colours follow their published palette references; controls retain Taskflow's visual style. The Solarized option is a light palette inspired by [Solarized](https://ethanschoonover.com/solarized/).
- **Runtime:** [llama.cpp b11146](https://github.com/ggml-org/llama.cpp/tree/b11146), **MIT**. Bundled LLVM/OpenMP notices use **Apache-2.0 with LLVM exceptions** and are preserved in the package.
- **Libraries:** React/React DOM, Vite, and Zod (MIT); TypeScript (Apache-2.0); Tauri and its plugins (MIT OR Apache-2.0); SQLite (public domain). Upstream and transitive dependency notices continue to apply.
- **Development assistance:** implementation and checks were assisted by OpenAI Codex. The application's inference runs locally with Gemma, independently of that development tooling.
- No third-party task text or original Taskflow implementation is included in the screenshots; their data comes from synthetic test fixtures.

## Post-deadline change disclosure — updated October 5, 2026 (UTC)

**Deadline: October 5, 2026, 06:59 UTC.** The [DEV challenge rules](https://dev.to/challenges/hacktoberfest-weekend-2026-10-01) require commits after the submission deadline to be noted in the README.

**Post-deadline changes began October 5, 2026, 16:46 UTC.** The initial source snapshot, feature update, two code-review passes, README expansion, `v0.1.0` release preparation, and October 5 clipboard/scrolling fixes were pre-deadline work. The notification troubleshooting, theme/UI, logo, Chat switch and custom-reminder updates below are post-deadline work. They are committed in the source snapshot tagged [`desktop-update-2026-10-05`](https://github.com/S-Srinivasan-06/Taskflow-Local-hacktoberfest-weekend/tree/desktop-update-2026-10-05); Git records its actual commit timestamp and hash. The final installer was applied and packaging evidence recorded after 18:21 UTC on October 5. The original `v0.1.0` source tag and binary assets remain unchanged.

| UTC date/time | Commit/change | Scope and effect |
| --- | --- | --- |
| 2026-10-05 UTC (recorded 18:27 UTC) | Documentation-only publication record | Records the exact source commit/time below, the published release URL and successful unauthenticated download checks in `docs/verification/release-2026-10-05.json`. This follow-up changes README/provenance metadata only; the dated release remains built from `110eacb`. Its commit hash/time are available in [README history](https://github.com/S-Srinivasan-06/Taskflow-Local-hacktoberfest-weekend/commits/main/README.md). |
| 2026-10-05 18:23:49 UTC | [`110eacb`](https://github.com/S-Srinivasan-06/Taskflow-Local-hacktoberfest-weekend/commit/110eacb66cd05af52cf65f38497e1c996ffa67ce) — desktop update source | Commits all notification, theme/UI, original-logo, Chat-switch and custom-reminder changes described below, plus dated screenshots, README disclosure, release notes and build evidence. The published `desktop-update-2026-10-05` tag points to this commit. This is a post-deadline source/package update; the original `v0.1.0` tag and assets were not overwritten. |
| 2026-10-05 UTC (requested 18:13 UTC) | Custom reminders in the dated release | Adds **Custom date and time** in `src/components/task/TaskEditor.tsx` and a small style rule. Validates future reminders at/before the task time, preserves exact seconds, displays the same lead-time adjustment used by the task service when rescheduling, and avoids re-arming unchanged fired reminders from an old editor. Updates documentation and rebuilds the installer. This is post-deadline functionality, UI, documentation and packaging work. |
| 2026-10-05 UTC (requested 18:00 UTC) | Chat switch in the dated release | Adds a saved on/off switch in `src/app/App.tsx`, request/save busy coordination in `Composer.tsx`, and switch styles/tokens. Disabling chat hides the composer, discards unsaved chat state and unloads a loaded local model; re-enabling focuses the input without loading it. Manual task controls and reminders remain available. Updates README/release evidence and rebuilds the installer. This is post-deadline functionality, UI, documentation and packaging work. |
| 2026-10-05 UTC (began 17:40 UTC) | Original logo, darker palettes and dated release | Reuses the author's original SVG symbol in `src/assets/`, the app header, favicon and generated Windows icons. Darkens Forest and Autumn in `src/styles/tokens.css`. Rebuilds and installs the updated app, adds dated synthetic theme screenshots, updates logo attribution and release documentation, and publishes new installer/portable assets under `desktop-update-2026-10-05`. Functionality, design, packaging, documentation and demo assets changed after the deadline. Application version metadata remains `0.1.0`; the dated tag distinguishes this build. |
| 2026-10-05 UTC (recorded 17:29 UTC) | Theme and UI update in the dated release | Adds Cyberpunk, Dark Grey, Full Black, Forest, Bubblegum and Autumn in `src/styles/tokens.css` and `src/state/preferences.ts`; replaces the theme dropdown with accessible palette previews in Settings. Refines task controls, sticky filters, native light/dark controls, focus indicators, completed-task readability and the pinned composer; adjusts initial timeline scrolling for the sticky filters. These are post-deadline functionality/design changes. |
| 2026-10-05 16:46 UTC | Notification troubleshooting in the dated release | Adds **Settings → Test notification** using the same native plugin as reminders, documents Windows installed-app registration, and rebuilds/installs the local NSIS installer. The old standalone launcher was removed and replaced by a shortcut to the installed app. Windows reports notifications enabled and accepted a diagnostic toast under the registered Taskflow identity; the database hash was unchanged immediately after installation and all 32 runtime files matched. Typecheck, 32 existing checks, Rust check and Windows build passed. Actual banner visibility and the app's Settings test button still require visual confirmation. |

Pre-deadline source milestones: [`e1517d0`](https://github.com/S-Srinivasan-06/Taskflow-Local-hacktoberfest-weekend/commit/e1517d01063e4a0c68014729f3d62d0ac81ca5f8) records the initial desktop snapshot; [`ca56052`](https://github.com/S-Srinivasan-06/Taskflow-Local-hacktoberfest-weekend/commit/ca56052fb236aa326c5a4dee022bb506e05f27fa) records the feature update and both code-review passes. The `v0.1.0` tag also includes the expanded documentation and release evidence.

For every later post-deadline commit or uncommitted change, append its actual UTC date/time, commit hash when available, files/features affected, and whether it changes functionality, packaging, documentation, or demo assets. Keep this section even for README-only or demo-only updates. Do not backdate commits or describe later work as part of the deadline build.

## Repository organization update

On October 5, 2026 UTC (work began at 18:44 UTC; October 6 locally), the repository was renamed to `Taskflow-Local-hacktoberfest-weekend`. The landing README was shortened, detailed material was split into usage/development/challenge guides, tests and check scripts were grouped by purpose, and the original build plan was archived under `docs/`. Paths and browser assertions were updated; an unused prototype icon source was removed. No model/runtime pins, lockfiles, app identifier, database location or installed data were changed. This is post-deadline documentation and development-organization work; the released October 5 installer remains the same binary. See the README for the current dated commit disclosure.
