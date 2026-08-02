/// 核心模块：纯业务模型，无外部依赖
pub mod core;
/// 服务层：封装平台相关逻辑
pub mod services;
/// Tauri Command 接口层
pub mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            // 注册全局快捷键（Ctrl+Shift+S 触发截图）
            services::shortcut_service::register_shortcuts(app.handle())
                .map_err(|e| Box::<dyn std::error::Error>::from(e))?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::window_cmd::create_window,
            commands::window_cmd::close_window,
            commands::window_cmd::set_always_on_top,
            commands::capture_cmd::capture_fullscreen,
            commands::capture_cmd::capture_region,
            commands::capture_cmd::monitor_count,
            commands::storage_cmd::save_to_file,
            commands::storage_cmd::copy_to_clipboard,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
