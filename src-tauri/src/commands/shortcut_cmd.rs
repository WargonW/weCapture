use crate::services::shortcut_config::{ShortcutAction, ShortcutConfig};
use crate::services::shortcut_service;
use tauri::AppHandle;

/// 获取当前快捷键配置
#[tauri::command]
pub fn get_shortcuts(app: AppHandle) -> Result<ShortcutConfig, String> {
    Ok(ShortcutConfig::load(&app))
}

/// 更新指定动作的快捷键
/// - 注销旧快捷键、注册新快捷键、持久化配置
#[tauri::command]
pub fn update_shortcut(
    app: AppHandle,
    action: String,
    new_shortcut: String,
) -> Result<(), String> {
    let action = ShortcutAction::from_str(&action)
        .ok_or_else(|| format!("未知快捷键动作: {}", action))?;

    let mut config = ShortcutConfig::load(&app);
    let old = config.get(action).to_string();

    // 先注册新快捷键（失败则不修改配置，保持原状）
    shortcut_service::update_shortcut(&app, action, &old, &new_shortcut)?;

    // 注册成功后再持久化
    config.set(action, new_shortcut);
    config.save(&app)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_shortcuts_command_signature() {
        let _f: fn(AppHandle) -> Result<ShortcutConfig, String> = get_shortcuts;
    }

    #[test]
    fn test_update_shortcut_command_signature() {
        let _f: fn(AppHandle, String, String) -> Result<(), String> = update_shortcut;
    }
}
