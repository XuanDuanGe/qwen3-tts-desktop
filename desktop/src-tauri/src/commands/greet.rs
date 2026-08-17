#[tauri::command]
pub fn greet(name: String) -> String {
  format!("你好，{name}！")
}
