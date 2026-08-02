/// 核心模块：纯业务模型，无外部依赖
pub mod core;
/// 服务层：封装平台相关逻辑
pub mod services;
/// Tauri Command 接口层
pub mod commands;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            // 录屏服务（全局单例，跨命令保持会话状态）
            app.manage(services::recorder_service::RecorderService::new());
            // 加载用户快捷键配置并注册全局快捷键
            let config = services::shortcut_config::ShortcutConfig::load(app.handle());
            services::shortcut_service::register_all(app.handle(), &config)
                .map_err(|e| Box::<dyn std::error::Error>::from(e))?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::window_cmd::create_window,
            commands::window_cmd::close_window,
            commands::window_cmd::set_always_on_top,
            commands::capture_cmd::capture_fullscreen,
            commands::capture_cmd::capture_region,
            commands::capture_cmd::capture_pixel,
            commands::capture_cmd::monitor_count,
            commands::capture_cmd::list_monitors,
            commands::storage_cmd::save_to_file,
            commands::storage_cmd::copy_to_clipboard,
            commands::shortcut_cmd::get_shortcuts,
            commands::shortcut_cmd::update_shortcut,
            commands::pin_cmd::stash_pin_image,
            commands::pin_cmd::take_pin_image,
            commands::recorder_cmd::start_recorder,
            commands::recorder_cmd::stop_recorder,
            commands::recorder_cmd::cancel_recorder,
            commands::recorder_cmd::recorder_state,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
