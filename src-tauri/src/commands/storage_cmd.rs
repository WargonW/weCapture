use crate::services::storage_service::StorageService;
use tauri::Manager;

/// 保存截图到文件，返回文件路径
#[tauri::command]
pub fn save_to_file(
    app: tauri::AppHandle,
    image_data: String,
) -> Result<String, String> {
    let base_dir = app
        .path()
        .home_dir()
        .map_err(|e| format!("获取用户目录失败: {}", e))?;
    StorageService::save_to_file(&image_data, &base_dir)
}

/// 复制截图到系统剪贴板
#[tauri::command]
pub fn copy_to_clipboard(image_data: String) -> Result<(), String> {
    StorageService::copy_to_clipboard(&image_data)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_save_to_file_command_signature() {
        // 验证函数签名存在
        let _f: fn(tauri::AppHandle, String) -> Result<String, String> = save_to_file;
    }

    #[test]
    fn test_copy_to_clipboard_command_signature() {
        let _f: fn(String) -> Result<(), String> = copy_to_clipboard;
    }
}