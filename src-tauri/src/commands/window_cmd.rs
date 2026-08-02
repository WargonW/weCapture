use crate::core::window_config::{WindowConfig, WindowType};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

/// 创建新窗口
#[tauri::command]
pub fn create_window(
    app: tauri::AppHandle,
    window_type_str: String,
    label_suffix: Option<String>,
) -> Result<String, String> {
    let window_type = WindowType::from_str(&window_type_str)
        .ok_or_else(|| format!("未知窗口类型: {}", window_type_str))?;

    let mut config = WindowConfig::from_type(window_type);
    if let Some(suffix) = label_suffix {
        config = config.with_unique_label(&suffix);
    }

    let url = WebviewUrl::App(config.to_url().into());
    let window = WebviewWindowBuilder::new(&app, &config.label, url)
        .title(&config.title)
        .inner_size(config.width as f64, config.height as f64)
        .fullscreen(config.fullscreen)
        .always_on_top(config.always_on_top)
        .decorations(config.decorations)
        .resizable(config.resizable)
        .build()
        .map_err(|e| format!("创建窗口失败: {}", e))?;

    Ok(window.label().to_string())
}

/// 关闭指定窗口
#[tauri::command]
pub fn close_window(app: tauri::AppHandle, label: String) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&label) {
        window.close().map_err(|e| format!("关闭窗口失败: {}", e))?;
    }
    Ok(())
}

/// 设置窗口置顶状态
#[tauri::command]
pub fn set_always_on_top(
    app: tauri::AppHandle,
    label: String,
    on_top: bool,
) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&label) {
        window
            .set_always_on_top(on_top)
            .map_err(|e| format!("设置置顶失败: {}", e))?;
    }
    Ok(())
}
