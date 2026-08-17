mod commands;
mod logger;

use std::time::Instant;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let startup_started_at = Instant::now();

    match logger::init() {
        Ok(log_file_path) => logger::info(
            "app.bootstrap",
            format!("log file initialized at {}", log_file_path.display()),
        ),
        Err(error) => eprintln!("failed to initialize logger: {error}"),
    }

    logger::info("app.bootstrap", "application startup begin");
    logger::error("app.bootstrap", "error level channel ready");

    tauri::Builder::default()
        .setup(move |app| {
            logger::info("app.lifecycle", "tauri setup begin");

            if let Some(window) = app.get_webview_window("main") {
                let startup_elapsed_ms = startup_started_at.elapsed().as_secs_f64() * 1000.0;
                logger::info(
                    "app.lifecycle",
                    format!(
                        "main window ready label={} startup_ms={startup_elapsed_ms:.3}",
                        window.label()
                    ),
                );
            } else {
                logger::warn("app.lifecycle", "main window not found during setup");
            }

            Ok(())
        })
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::Focused(true) => {
                logger::debug(
                    "window.lifecycle",
                    format!("window focused label={}", window.label()),
                );
            }
            tauri::WindowEvent::Focused(false) => {
                logger::debug(
                    "window.lifecycle",
                    format!("window blurred label={}", window.label()),
                );
            }
            tauri::WindowEvent::Destroyed => {
                logger::info(
                    "window.lifecycle",
                    format!("window destroyed label={}", window.label()),
                );
            }
            tauri::WindowEvent::CloseRequested { .. } => {
                logger::info(
                    "window.lifecycle",
                    format!("window close requested label={}", window.label()),
                );
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![commands::record_frontend_metric])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

    logger::info("app.bootstrap", "application runtime finished");
}
