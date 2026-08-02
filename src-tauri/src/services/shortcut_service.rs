use crate::core::window_config::{WindowConfig, WindowType};
use crate::services::shortcut_config::{ShortcutAction, ShortcutConfig};
use tauri::{AppHandle, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

/// 动作 -> 窗口类型映射
fn action_to_window_type(action: ShortcutAction) -> WindowType {
    match action {
        ShortcutAction::Screenshot => WindowType::Capture,
        ShortcutAction::Recorder => WindowType::Recorder,
        ShortcutAction::Pin => WindowType::Pin,
        ShortcutAction::ColorPicker => WindowType::ColorPicker,
    }
}

/// 打开动作对应的窗口
fn open_action_window(app: &AppHandle, action: ShortcutAction) {
    let window_type = action_to_window_type(action);
    let config = WindowConfig::from_type(window_type).with_unique_label(&timestamp_str());
    let url = WebviewUrl::App(config.to_url().into());

    if let Err(e) = WebviewWindowBuilder::new(app, &config.label, url)
        .title(&config.title)
        .inner_size(config.width as f64, config.height as f64)
        .fullscreen(config.fullscreen)
        .always_on_top(config.always_on_top)
        .decorations(config.decorations)
        .resizable(config.resizable)
        .build()
    {
        log::error!("打开 {:?} 窗口失败: {}", action, e);
    }
}

/// 注册单个快捷键
pub fn register_one(
    app: &AppHandle,
    action: ShortcutAction,
    shortcut: &str,
) -> Result<(), String> {
    let sc: Shortcut = shortcut
        .parse()
        .map_err(|e| format!("解析快捷键失败 {}: {}", shortcut, e))?;
    app.global_shortcut()
        .on_shortcut(sc, move |app, _s, event| {
            if event.state() == ShortcutState::Pressed {
                open_action_window(app, action);
            }
        })
        .map_err(|e| format!("注册快捷键失败 {}: {}", shortcut, e))?;
    Ok(())
}

/// 注销单个快捷键
pub fn unregister_one(app: &AppHandle, shortcut: &str) -> Result<(), String> {
    let sc: Shortcut = shortcut
        .parse()
        .map_err(|e| format!("解析快捷键失败 {}: {}", shortcut, e))?;
    app.global_shortcut()
        .unregister(sc)
        .map_err(|e| format!("注销快捷键失败 {}: {}", shortcut, e))?;
    Ok(())
}

/// 注册配置中的所有快捷键
pub fn register_all(app: &AppHandle, config: &ShortcutConfig) -> Result<(), String> {
    for action in ShortcutAction::all() {
        let shortcut = config.get(*action);
        register_one(app, *action, shortcut)?;
    }
    Ok(())
}

/// 更新快捷键：注销旧的，注册新的（新旧相同则仅注册）
pub fn update_shortcut(
    app: &AppHandle,
    action: ShortcutAction,
    old: &str,
    new: &str,
) -> Result<(), String> {
    if old != new {
        // 旧的注册失败也忽略，避免阻塞新快捷键注册
        let _ = unregister_one(app, old);
    }
    register_one(app, action, new)
}

/// 当前时间戳字符串（用于唯一 label）
fn timestamp_str() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_action_to_window_type_mapping() {
        assert_eq!(action_to_window_type(ShortcutAction::Screenshot), WindowType::Capture);
        assert_eq!(action_to_window_type(ShortcutAction::Recorder), WindowType::Recorder);
        assert_eq!(action_to_window_type(ShortcutAction::Pin), WindowType::Pin);
        assert_eq!(action_to_window_type(ShortcutAction::ColorPicker), WindowType::ColorPicker);
    }

    #[test]
    fn test_timestamp_str_is_unique_enough() {
        let a = timestamp_str();
        // 等待极少时间避免相同毫秒
        std::thread::sleep(std::time::Duration::from_millis(2));
        let b = timestamp_str();
        assert_ne!(a, b, "时间戳应递增");
    }

    #[test]
    fn test_timestamp_str_non_empty() {
        let s = timestamp_str();
        assert!(!s.is_empty());
    }

    #[test]
    fn test_all_actions_covered() {
        // 确保映射覆盖所有动作
        for action in ShortcutAction::all() {
            let _wt = action_to_window_type(*action);
        }
    }
}
