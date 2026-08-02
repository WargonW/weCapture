/// 核心模块：纯业务模型，无外部依赖
pub mod core;
/// Tauri Command 接口层
pub mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::window_cmd::create_window,
            commands::window_cmd::close_window,
            commands::window_cmd::set_always_on_top,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
