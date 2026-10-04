use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};

mod model_process;

fn restore_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            restore_main_window(app);
        }))
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            model_process::start_local_model,
            model_process::model_running,
            model_process::model_set_busy,
            model_process::stop_model,
            model_process::model_exists,
            model_process::open_models_folder,
        ])
        .setup(|app| {
            model_process::kill_stale();
            let model = model_process::ModelProcess::default();
            model_process::start_idle_timer(model.clone());
            app.manage(model);

            let open = MenuItem::with_id(app, "open", "Open", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &quit])?;
            let icon = app
                .default_window_icon()
                .cloned()
                .ok_or("application icon is missing")?;

            TrayIconBuilder::with_id("taskflow")
                .icon(icon)
                .tooltip("Taskflow Local")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => restore_main_window(app),
                    "quit" => {
                        if let Some(model) = app.try_state::<model_process::ModelProcess>() {
                            let _ = model.stop();
                        }
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        restore_main_window(tray.app_handle());
                    }
                })
                .build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    if window.hide().is_ok() {
                        api.prevent_close();
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("could not run Taskflow Local");
}
