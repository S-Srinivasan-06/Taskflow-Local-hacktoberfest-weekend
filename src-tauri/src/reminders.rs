use std::{
    collections::{HashMap, HashSet},
    sync::{Arc, Mutex},
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter};
use tauri_plugin_notification::NotificationExt;

type Reminder = (String, String, String, u64);

#[derive(Clone, Default)]
pub struct Reminders(Arc<Mutex<ReminderState>>);

#[derive(Default)]
struct ReminderState {
    pending: HashMap<String, Reminder>,
    delivered: HashSet<(String, String)>,
}

pub fn start(app: AppHandle, reminders: Reminders) {
    let _ = thread::Builder::new()
        .name("taskflow-reminders".into())
        .spawn(move || loop {
            thread::sleep(Duration::from_secs(1));
            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64;
            let Ok(mut state) = reminders.0.lock() else {
                continue;
            };
            let due: Vec<_> = state
                .pending
                .values()
                .filter(|reminder| reminder.3 <= now)
                .cloned()
                .collect();
            for (id, title, at, _) in due {
                // Queue replacement and delivery share a lock so they cannot interleave.
                state.pending.remove(&id);
                let key = (id.clone(), at.clone());
                if state.delivered.contains(&key) {
                    continue;
                }
                if app
                    .notification()
                    .builder()
                    .title("Taskflow reminder")
                    .body(title)
                    .show()
                    .is_ok()
                {
                    state.delivered.insert(key.clone());
                    let _ = app.emit("reminder-fired", key);
                } else {
                    let _ = app.emit(
                        "reminder-error",
                        "Windows could not show a reminder. Check notification settings.",
                    );
                }
            }
        });
}

#[tauri::command]
pub fn sync_reminders(
    reminders: tauri::State<'_, Reminders>,
    tasks: Vec<Reminder>,
) -> Result<(), String> {
    if tasks.len() > 10000 {
        return Err("Too many reminders".into());
    }
    let mut state = reminders
        .0
        .lock()
        .map_err(|_| "Reminder state is unavailable")?;
    state.pending = tasks
        .into_iter()
        .filter(|task| !state.delivered.contains(&(task.0.clone(), task.2.clone())))
        .map(|task| (task.0.clone(), task))
        .collect();
    Ok(())
}
