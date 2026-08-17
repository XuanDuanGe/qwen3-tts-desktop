mod commands;
mod models;
mod utils;

pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![commands::greet::greet])
    .run(tauri::generate_context!())
    .expect("error while running Tauri application");
}
