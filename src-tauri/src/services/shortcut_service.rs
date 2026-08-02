use tauri::{WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

/// 截图快捷键：Ctrl+Shift+S
pub const CAPTURE_SHORTCUT: &str = "Ctrl+Shift+S";

/// 注册全局快捷键
pub fn register_shortcuts(app: &tauri::AppHandle) -> Result<(), String> {
    let shortcut: Shortcut = CAPTURE_SHORTCUT
        .parse()
        .map_err(|e| format!("解析快捷键失败: {}", e))?;

    app.global_shortcut().on_shortcut(shortcut, move |app, _shortcut, event| {
        if event.state() == ShortcutState::Pressed {
            open_capture_window(app);
        }
    }).map_err(|e| format!("注册快捷键失败: {}", e))?;

    Ok(())
}

/// 打开截图窗口
fn open_capture_window(app: &tauri::AppHandle) {
    let label = format!("capture-{}", timestamp());
    let url = WebviewUrl::App("?window=capture".into());

    if let Err(e) = WebviewWindowBuilder::new(app, &label, url)
        .title("截图")
        .fullscreen(true)
        .decorations(false)
        .resizable(false)
        .build()
    {
        log::error!("快捷键打开截图窗口失败: {}", e);
    }
}

/// 当前时间戳（用于唯一标识）
fn timestamp() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_capture_shortcut_constant() {
        assert_eq!(CAPTURE_SHORTCUT, "Ctrl+Shift+S");
    }

    #[test]
    fn test_timestamp_returns_positive() {
        let ts = timestamp();
        assert!(ts > 0);
    }
}
