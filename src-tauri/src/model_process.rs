use std::{
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::{Arc, Mutex},
    thread,
    time::{Duration, Instant},
};

#[cfg(not(debug_assertions))]
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};

#[derive(Clone, Default)]
pub struct ModelProcess(Arc<Mutex<Option<RunningModel>>>);

struct RunningModel {
    child: Child,
    busy: bool,
    last_used: Instant,
}

impl ModelProcess {
    pub fn start(
        &self,
        app: &AppHandle,
        filename: &str,
        projector: Option<&str>,
        api_key: &str,
        port: u16,
    ) -> Result<(), String> {
        if !valid_filename(filename)
            || projector.is_some_and(|file| !valid_filename(file))
            || api_key.len() < 16
            || api_key.len() > 128
            || !api_key
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || b"_-".contains(&byte))
            || !(1024..=65535).contains(&port)
        {
            return Err("Invalid local model configuration".into());
        }

        let mut running = self.0.lock().map_err(|_| "Model state is unavailable")?;
        if let Some(model) = running.as_mut() {
            if model
                .child
                .try_wait()
                .map_err(|error| error.to_string())?
                .is_none()
            {
                model.busy = true;
                model.last_used = Instant::now();
                return Ok(());
            }
            *running = None;
        }

        let models_dir = app
            .path()
            .app_local_data_dir()
            .map_err(|error| error.to_string())?
            .join("models");
        let model_path = models_dir.join(filename);
        if !model_path.is_file() {
            return Err("Local model not found".into());
        }
        let projector_path = projector.map(|file| models_dir.join(file));
        if projector_path.as_ref().is_some_and(|path| !path.is_file()) {
            return Err("Image projector not found".into());
        }

        #[cfg(debug_assertions)]
        let runtime =
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("runtime/llama/taskflow-llama.exe");
        #[cfg(not(debug_assertions))]
        let runtime = app
            .path()
            .resolve("runtime/llama/taskflow-llama.exe", BaseDirectory::Resource)
            .map_err(|error| format!("Local runtime not found: {error}"))?;
        if !runtime.is_file() {
            return Err("Local runtime not found".into());
        }
        let working_dir = runtime.parent().ok_or("Local runtime path is invalid")?;
        let working_dir = strip_verbatim_prefix(working_dir);
        let mut command = hidden_command(&runtime);
        if let Some(path) = projector_path {
            command
                .arg("--mmproj")
                .arg(path)
                .args(["--image-max-tokens", "1024"]);
        }
        let child = command
            .arg("--model")
            .arg(model_path)
            .arg("--host")
            .arg("127.0.0.1")
            .arg("--port")
            .arg(port.to_string())
            .arg("--ctx-size")
            .arg("4096")
            .arg("--parallel")
            .arg("1")
            .arg("--jinja")
            .arg("--no-ui")
            .arg("--log-disable")
            .arg("--api-key")
            .arg(api_key)
            .current_dir(working_dir)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|error| format!("Could not start local model: {error}"))?;
        *running = Some(RunningModel {
            child,
            busy: true,
            last_used: Instant::now(),
        });
        Ok(())
    }

    pub fn is_running(&self) -> Result<bool, String> {
        let mut running = self.0.lock().map_err(|_| "Model state is unavailable")?;
        let Some(model) = running.as_mut() else {
            return Ok(false);
        };
        if model
            .child
            .try_wait()
            .map_err(|error| error.to_string())?
            .is_none()
        {
            Ok(true)
        } else {
            *running = None;
            Ok(false)
        }
    }

    pub fn set_busy(&self, busy: bool) -> Result<(), String> {
        let mut running = self.0.lock().map_err(|_| "Model state is unavailable")?;
        if let Some(model) = running.as_mut() {
            model.busy = busy;
            model.last_used = Instant::now();
        }
        Ok(())
    }

    pub fn stop(&self) -> Result<(), String> {
        let mut running = self.0.lock().map_err(|_| "Model state is unavailable")?;
        Self::stop_running(&mut running)
    }

    fn stop_running(running: &mut Option<RunningModel>) -> Result<(), String> {
        // Retain the handle if stopping fails, so a later Quit/Unload can retry.
        if let Some(model) = running.as_mut() {
            if model
                .child
                .try_wait()
                .map_err(|error| error.to_string())?
                .is_none()
            {
                model.child.kill().map_err(|error| error.to_string())?;
                let _ = model.child.wait();
            }
        }
        *running = None;
        Ok(())
    }

    fn stop_if_idle(&self, timeout: Duration) -> Result<(), String> {
        let mut running = self.0.lock().map_err(|_| "Model state is unavailable")?;
        // Keep the check and stop under one lock: a new request must not become busy between them.
        if running
            .as_ref()
            .is_some_and(|model| !model.busy && model.last_used.elapsed() >= timeout)
        {
            Self::stop_running(&mut running)?;
        }
        Ok(())
    }
}

fn valid_filename(filename: &str) -> bool {
    filename.ends_with(".gguf")
        && filename.len() <= 160
        && filename
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || b"._-".contains(&byte))
}

fn strip_verbatim_prefix(path: &std::path::Path) -> PathBuf {
    let path = path.to_string_lossy();
    #[cfg(windows)]
    if let Some(path) = path.strip_prefix(r"\\?\") {
        return PathBuf::from(path);
    }
    PathBuf::from(path.as_ref())
}

#[cfg(windows)]
fn hidden_command(path: &std::path::Path) -> Command {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    let mut command = Command::new(path);
    command.creation_flags(CREATE_NO_WINDOW);
    command
}

#[cfg(not(windows))]
fn hidden_command(path: &std::path::Path) -> Command {
    Command::new(path)
}

#[cfg(windows)]
pub fn kill_stale() {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    let _ = Command::new("taskkill.exe")
        .args(["/F", "/IM", "taskflow-llama.exe"])
        .creation_flags(CREATE_NO_WINDOW)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();
}

#[cfg(not(windows))]
pub fn kill_stale() {}

pub fn start_idle_timer(process: ModelProcess) {
    let timeout = if cfg!(debug_assertions) {
        Duration::from_secs(60)
    } else {
        Duration::from_secs(30 * 60)
    };
    let _ = thread::Builder::new()
        .name("taskflow-model-idle".into())
        .spawn(move || loop {
            thread::sleep(Duration::from_secs(5));
            let _ = process.stop_if_idle(timeout);
        });
}

#[tauri::command]
pub fn model_running(process: tauri::State<'_, ModelProcess>) -> Result<bool, String> {
    process.is_running()
}

#[tauri::command]
pub fn model_set_busy(process: tauri::State<'_, ModelProcess>, busy: bool) -> Result<(), String> {
    process.set_busy(busy)
}

#[tauri::command]
pub fn stop_model(process: tauri::State<'_, ModelProcess>) -> Result<(), String> {
    process.stop()
}

#[tauri::command]
pub fn model_exists(app: AppHandle, filename: String) -> Result<bool, String> {
    if !valid_filename(&filename) {
        return Err("Invalid local model configuration".into());
    }
    let directory = app
        .path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())?
        .join("models");
    Ok(directory.join(filename).is_file())
}

#[tauri::command]
pub fn start_local_model(
    process: tauri::State<'_, ModelProcess>,
    app: AppHandle,
    filename: String,
    projector: Option<String>,
    api_key: String,
    port: u16,
) -> Result<(), String> {
    process.start(&app, &filename, projector.as_deref(), &api_key, port)
}

#[tauri::command]
pub fn list_models(app: AppHandle) -> Result<Vec<String>, String> {
    let directory = app
        .path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())?
        .join("models");
    std::fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    let mut files = Vec::new();
    for entry in std::fs::read_dir(directory).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        // Only files directly inside Models; no traversal or symlink targets.
        if entry
            .file_type()
            .map_err(|error| error.to_string())?
            .is_file()
        {
            if let Some(filename) = entry.file_name().to_str() {
                if valid_filename(filename) {
                    files.push(filename.to_string());
                }
            }
        }
    }
    files.sort();
    Ok(files)
}

#[tauri::command]
pub fn open_models_folder(app: AppHandle) -> Result<(), String> {
    let directory = app
        .path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())?
        .join("models");
    std::fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    #[cfg(windows)]
    hidden_command(std::path::Path::new("explorer.exe"))
        .arg(directory)
        .spawn()
        .map_err(|error| error.to_string())?;
    Ok(())
}
