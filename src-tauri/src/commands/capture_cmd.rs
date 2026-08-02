use crate::core::color::RgbColor;
use crate::core::screenshot::{CaptureRegion, ScreenshotResult};
use crate::services::capture_service::CaptureService;

/// 全屏截图：采集主显示器，返回 Base64 PNG
#[tauri::command]
pub fn capture_fullscreen() -> Result<ScreenshotResult, String> {
    CaptureService::capture_fullscreen()
}

/// 区域截图：传入选区，返回 Base64 PNG
#[tauri::command]
pub fn capture_region(region: CaptureRegion) -> Result<ScreenshotResult, String> {
    CaptureService::capture_region(region)
}

/// 像素取色：传入屏幕坐标，返回 RGB 颜色
#[tauri::command]
pub fn capture_pixel(x: i32, y: i32) -> Result<RgbColor, String> {
    CaptureService::capture_pixel(x, y)
}

/// 获取显示器数量
#[tauri::command]
pub fn monitor_count() -> Result<usize, String> {
    CaptureService::monitor_count()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_capture_region_command_rejects_invalid_region() {
        // 无效区域应在服务层返回错误
        let invalid = CaptureRegion::new(0, 0, 0, 0);
        let result = capture_region(invalid);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "无效的截图区域");
    }

    #[test]
    fn test_capture_pixel_command_rejects_negative() {
        let result = capture_pixel(-1, 0);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "坐标不能为负数");

        let result = capture_pixel(0, -1);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "坐标不能为负数");
    }

    #[test]
    fn test_capture_fullscreen_command_signature() {
        // 仅验证函数可被作为 command 调用（签名存在）
        let _f: fn() -> Result<ScreenshotResult, String> = capture_fullscreen;
    }

    #[test]
    fn test_capture_pixel_command_signature() {
        let _f: fn(i32, i32) -> Result<RgbColor, String> = capture_pixel;
    }

    #[test]
    fn test_monitor_count_command_signature() {
        let _f: fn() -> Result<usize, String> = monitor_count;
    }
}
