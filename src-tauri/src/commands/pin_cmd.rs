use crate::services::pin_service;

/// 暂存贴图数据（截图窗口创建贴图窗口前调用）
#[tauri::command]
pub fn stash_pin_image(label: String, data_url: String) -> Result<(), String> {
    pin_service::stash(&label, &data_url);
    Ok(())
}

/// 取出贴图数据（贴图窗口启动时调用，取后即删）
#[tauri::command]
pub fn take_pin_image(label: String) -> Result<Option<String>, String> {
    Ok(pin_service::take(&label))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::pin_service;

    #[test]
    fn test_stash_and_take_command_roundtrip() {
        pin_service::clear();
        stash_pin_image("cmd-1".to_string(), "data:url".to_string()).unwrap();
        let v = take_pin_image("cmd-1".to_string()).unwrap();
        assert_eq!(v.as_deref(), Some("data:url"));
    }

    #[test]
    fn test_take_nonexistent_returns_none() {
        pin_service::clear();
        let v = take_pin_image("nope".to_string()).unwrap();
        assert_eq!(v, None);
    }

    #[test]
    fn test_stash_pin_image_command_signature() {
        let _f: fn(String, String) -> Result<(), String> = stash_pin_image;
    }

    #[test]
    fn test_take_pin_image_command_signature() {
        let _f: fn(String) -> Result<Option<String>, String> = take_pin_image;
    }
}
