# Using Taskflow Local

[Back to the README](../README.md) · [Developer guide](development.md)

## Installation requirements and EXE usage

**For an end user:** a Windows x64 PC and Microsoft Edge WebView2. The CPU runtime is bundled; a GPU, Node, Rust, Python, Ollama, and API keys are not required to use an installed app.

Allow disk space for the app and the approximately 3.35 GB model, plus approximately 987 MB for optional screenshot support and working space for downloads. The runtime/model were checked on the development machine, not across a hardware compatibility matrix.

The generated installer is:

```text
src-tauri/target/release/bundle/nsis/Taskflow Local_0.1.0_x64-setup.exe
```

Download the installer from [GitHub Releases](https://github.com/S-Srinivasan-06/Taskflow-Local-hacktoberfest-weekend/releases/tag/desktop-update-2026-10-05). Release binaries are attached as assets rather than checked into source history.

1. Run the installer and finish setup.
2. Launch **Taskflow Local** from the Start menu.
3. Add a task manually; no model is needed for this.
4. Install the model as described below to enable language commands.
5. Closing the window keeps the app in the tray. Windows may place the icon inside the **^** overflow menu.
6. Left-click the tray icon or choose **Open** to restore the window. Right-click and choose **Quit** to stop the app and model completely.

The build is unsigned. Windows may show SmartScreen; for a build you trust from this project, select **More info → Run anyway**.

The direct release EXE is `src-tauri/target/release/taskflow-local.exe`. Keep the matching `runtime/llama/` directory beside it; moving only the EXE breaks language runtime discovery. The installer supplies that layout automatically.

For the portable package, extract the **entire ZIP** into a folder and open `taskflow-local.exe` there. Its runtime folder and notices must remain beside it. The ZIP avoids app installation, but tasks and model files still use the Windows user data folders below; this is not a self-contained USB data store. Use the installed version when checking Windows notifications.

### Verify a release download

Download `SHA256SUMS.txt` from the same release and compare its entry with:

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath '.\Taskflow-Local-2026-10-05-windows-x64-setup.exe'
```

The checksums identify the published files. They do not replace code signing; this release remains unsigned. To replace an older build, choose **Quit** in its tray menu first, then install the new build. Task/model storage is separate from the program directory.

## Model-file placement

The installer contains the runtime, all its DLLs, and runtime license notices. **It does not contain or automatically download model or projector files.**

1. Download [the pinned GGUF file](https://huggingface.co/google/gemma-4-E2B-it-qat-q4_0-gguf/resolve/675cff42a74c774d6cb76f76d8eacb49b48c9b93/gemma-4-E2B_q4_0-it.gguf).
2. Expand **Settings → Local model → Open Models Folder**, or use the missing-model control.
3. Place the file there with this exact name: `gemma-4-E2B_q4_0-it.gguf`.
4. Expand **Settings → Local model**, choose **Refresh models**, select the downloaded model, then enable Chat and send a request. Restarting the app is not required.

The Windows path is:

```text
%LOCALAPPDATA%\com.taskflow.local\models\gemma-4-E2B_q4_0-it.gguf
```

Verify the downloaded file in PowerShell:

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath "$env:LOCALAPPDATA\com.taskflow.local\models\gemma-4-E2B_q4_0-it.gguf"
```

Compare the result with the [pinned model hash in the developer guide](development.md#gemma-and-llamacpp). The app currently checks file presence, not the hash at every startup. The development copy was hash-verified and downloaded anonymously; a literal private-browser-window download was not separately checked.

### Screenshot input and other downloaded models

For the default Gemma model, download [the matching projector](https://huggingface.co/google/gemma-4-E2B-it-qat-q4_0-gguf/resolve/675cff42a74c774d6cb76f76d8eacb49b48c9b93/gemma-4-E2B-it-mmproj.gguf) into the same Models folder and verify its [pinned hash](development.md#gemma-and-llamacpp). Choose it under **Settings → Local model → Image projector**. It loads only when an image request needs it.

Select **Image** beside the composer, attach one PNG/JPEG up to 5 MiB, and type an instruction or send the image alone. The model proposes one task. If the screenshot has no usable time, answer the clarification. Review the title, time, and duration before approving; images never bypass validation or approval.

For another GGUF model, place it directly in the Models folder, choose **Refresh models** under **Settings → Local model**, then select it. Choose its matching projector if it supports images. Changing models unloads the app-owned runtime. Alternative model compatibility and accuracy have not been checked against real models.

### Optional Ollama

If you already use [Ollama](https://docs.ollama.com/), start it locally and download a local model using its own tools. Settings lists available local models from `127.0.0.1:11434`; Taskflow does not install Ollama or pull models. Cloud models are excluded. Screenshot input requires a model advertising vision support.

Ollama uses the same JSON schema, validation, and approval flow. The official Tauri HTTP plugin handles local requests without requiring WebView CORS configuration. Requests disable thinking and use a 60-second development / 30-minute production keep-alive. **Unload model** requests unloading; quitting Taskflow does not terminate a separately managed Ollama service. This provider has been tested with mocks, not a real Ollama installation.

## Basic usage

Manual: select **+ New task**, enter a title and time, then save. Use each row's controls to edit, change status, mark read/unread, or delete.

Search matches task titles. Combine it with status and local-date filters. Outside text fields, **N** or **C** opens the task editor, **/** focuses search, and **Esc** closes the editor/settings or clears filters. Choose a colour scheme in **Settings**; it is remembered on restart.

### Desktop reminders

In the task editor, choose **At task time**, or **5, 15, 30, or 60 minutes before**, or **Custom date and time**, then save. A new/custom reminder must be in the future and at or before the task time. Custom reminders retain their lead time when the task is moved unless you edit the reminder too. Allow notifications when requested. Completing or deleting a task cancels its reminder; moving a task preserves its reminder lead time. After queuing a notification, the app clears the saved reminder through the same task-command service.

Reminder setup currently uses the manual editor. Language commands can move a task that already has a reminder, but the action contract does not yet include a command for choosing a new reminder interval.

The native timer runs while Taskflow is open, including when the window is hidden. **Tray → Quit stops reminders.** On restart, reminders missed by up to five minutes can be delivered; older missed reminders are not replayed. Windows notification settings and Do Not Disturb affect delivery. Actual toast delivery still needs an installed-build check.

English examples:

- “Add reading tomorrow at 8 PM for 30 minutes.”
- “Show my unread tasks.”
- “Move reading to tomorrow at 9 PM.”
- “Mark reading as done.”
- “Delete reading.”

Tamil example to try:

> நாளை காலை 9 மணிக்கு அம்மாவை அழைக்க வேண்டும் என்ற பணியைச் சேர்.

Meaning: add a task to call Amma tomorrow at 9 AM. Titles are kept in the user's language. **This non-English request has not been verified against the real model**; the five recorded model checks were in English. Check the proposed title and time before approving.

## Persistence and restart behavior

SQLite is the source of truth. One `tasks` table stores UUID, title, UTC scheduled time, optional duration, status, read state, optional UTC reminder time, and creation/update/deletion timestamps. Delete sets `deleted_at_utc`; normal reads exclude deleted rows. No separate reminders table is needed.

The database is `taskflow-local.db` in Tauri's per-user application config directory, normally `%APPDATA%\com.taskflow.local\`. The model is under `%LOCALAPPDATA%` separately. The app does not use browser localStorage for tasks.

Normal Quit and reopen reload saved tasks. React chat, pending approvals, and clarification state do not persist. Closing only the window keeps the same process alive.

| Data | Location/lifetime |
| --- | --- |
| Tasks, status, read state, reminder time, soft-deletion timestamps | `taskflow-local.db` in the per-user application config directory |
| Model and image projector | `%LOCALAPPDATA%\com.taskflow.local\models\` |
| Theme, Chat on/off and selected model/projector | Local WebView preferences |
| Current request, screenshot, clarification, and pending proposal | App memory; discarded when the process ends |
| Reminder banners | Sent to Windows; notification history and visibility follow Windows settings |

Two launches restore the same running instance. They do not create independent task databases or model processes. Nothing is synchronized to other PCs, and the app has no account recovery or backup service.

The model starts on demand, unloads after **30 minutes idle in production / 60 seconds in development**, and can be unloaded manually. Startup removes stale processes named `taskflow-llama.exe` after single-instance registration; it does not target unrelated `llama-server.exe` processes.

## Local, offline, and privacy behavior

After installing the app, runtime, and model, normal task operations and language requests work without an internet connection.

- No application account, cloud sync, telemetry, or remote model API.
- SQLite task data remains in the Windows user's application directory.
- Bundled model requests go only to `127.0.0.1:39281`; the server binds to loopback and uses a per-session API key. Optional Ollama requests go to `127.0.0.1:11434`.
- Native HTTP permissions allow only those two local model addresses, and redirects are disabled. Ollama cloud tags and models reporting remote metadata are rejected before task context is sent.
- Production code does not log task text or prompts; the runtime's output is suppressed.
- Chat and pending proposals exist only in React memory and are discarded on restart.
- Screenshot inputs also stay in memory. Theme/model preferences use WebView storage; tasks remain in SQLite. When using separately managed Ollama, its own settings and logging remain under your control.
- Initial downloads, source dependency installation, and any WebView2 installation require internet access.
- Local does **not** mean encrypted: the SQLite database and model files are ordinary files protected by Windows permissions, not an app-level password or encrypted vault.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Local model is missing | Expand **Settings → Local model → Open Models Folder**, check the filename, and choose **Refresh models** |
| Image input is unavailable | Select an installed model and its matching projector, then refresh; Ollama must advertise vision capability |
| Ollama models do not appear | Start the separate local Ollama service and ensure a model has already been downloaded; cloud models are excluded |
| A request fails or times out | Keep the retained text/image, check the selected model, try **Unload**, then retry; manual tasks remain available |
| No reminder banner appears | Run the NSIS installer and launch the installed app; Windows toasts require its Start Menu registration. Use **Settings → Test notification**, then check Taskflow's Windows notification settings/Do Not Disturb. Keep Taskflow running, including in the tray. A queued notification does not prove that Windows displayed a banner. |
| The window disappears after closing | Find Taskflow in the tray, including the **^** overflow menu, and choose **Open** |
| A proposal says the task changed | Send the request again so it uses the latest saved task; the app does not overwrite the stale proposal silently |
| Portable language controls cannot start | Extract the full ZIP and keep `runtime/llama/` beside the executable |
