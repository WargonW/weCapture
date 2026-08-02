use base64::Engine;
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

/// 存储服务：保存到文件 / 复制到剪贴板
pub struct StorageService;

impl StorageService {
    /// 保存 Base64 PNG 到文件，返回文件路径
    pub fn save_to_file(image_data: &str, base_dir: &PathBuf) -> Result<String, String> {
        let data = base64::engine::general_purpose::STANDARD
            .decode(image_data)
            .map_err(|e| format!("Base64 解码失败: {}", e))?;

        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let filename = format!("snapmaster_{}.png", timestamp);
        let filepath = base_dir.join(filename);

        let mut file = fs::File::create(&filepath)
            .map_err(|e| format!("创建文件失败: {}", e))?;
        file.write_all(&data)
            .map_err(|e| format!("写入文件失败: {}", e))?;

        Ok(filepath.to_string_lossy().to_string())
    }

    /// 复制 Base64 PNG 图片到系统剪贴板
    pub fn copy_to_clipboard(image_data: &str) -> Result<(), String> {
        let data = base64::engine::general_purpose::STANDARD
            .decode(image_data)
            .map_err(|e| format!("Base64 解码失败: {}", e))?;

        let img = image::load_from_memory(&data)
            .map_err(|e| format!("图片解码失败: {}", e))?;
        let rgba = img.to_rgba8();
        let (w, h) = rgba.dimensions();

        let mut clipboard = arboard::Clipboard::new()
            .map_err(|e| format!("打开剪贴板失败: {}", e))?;

        let img_data = arboard::ImageData {
            width: w as usize,
            height: h as usize,
            bytes: std::borrow::Cow::Borrowed(rgba.as_raw()),
        };
        clipboard
            .set_image(img_data)
            .map_err(|e| format!("设置剪贴板失败: {}", e))?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    #[test]
    fn test_save_to_file_creates_file() {
        let temp_dir = env::temp_dir();
        let result = StorageService::save_to_file(
            "iVBORw0KGgo=",
            &temp_dir,
        );
        assert!(result.is_ok());
        let path = result.unwrap();
        assert!(path.contains("snapmaster_"));
        assert!(path.ends_with(".png"));
        // 清理
        let _ = fs::remove_file(&path);
    }

    #[test]
    fn test_save_to_file_invalid_base64() {
        let temp_dir = env::temp_dir();
        let result = StorageService::save_to_file("!!!invalid!!!", &temp_dir);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Base64 解码失败"));
    }

    #[test]
    fn test_copy_to_clipboard_invalid_base64() {
        let result = StorageService::copy_to_clipboard("!!!invalid!!!");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Base64 解码失败"));
    }
}