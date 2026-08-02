use crate::core::color::RgbColor;
use crate::core::screenshot::{CaptureRegion, MonitorInfo, ScreenshotResult};
use crate::services::capture_service::CaptureService;

/// 全屏截图：可选指定显示器 id（None=主显示器），返回 Base64 PNG
#[tauri::command]
pub fn capture_fullscreen(monitor_id: Option<u32>) -> Result<ScreenshotResult, String> {
    CaptureService::capture_fullscreen(monitor_id)
}

/// 区域截图：传入选区 + 可选显示器 id，返回 Base64 PNG
#[tauri::command]
pub fn capture_region(region: CaptureRegion, monitor_id: Option<u32>) -> Result<ScreenshotResult, String> {
    CaptureService::capture_region(region, monitor_id)
}

/// 像素取色：传入坐标 + 可选显示器 id，返回 RGB 颜色
#[tauri::command]
pub fn capture_pixel(x: i32, y: i32, monitor_id: Option<u32>) -> Result<RgbColor, String> {
    CaptureService::capture_pixel(x, y, monitor_id)
}

/// 获取显示器数量
#[tauri::command]
pub fn monitor_count() -> Result<usize, String> {
    CaptureService::monitor_count()
}

/// 列出所有显示器信息
#[tauri::command]
pub fn list_monitors() -> Result<Vec<MonitorInfo>, String> {
    CaptureService::list_monitors()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_capture_region_command_rejects_invalid_region() {
        let invalid = CaptureRegion::new(0, 0, 0, 0);
        let result = capture_region(invalid, None);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "无效的截图区域");
    }

    #[test]
    fn test_capture_pixel_command_rejects_negative() {
        let result = capture_pixel(-1, 0, None);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "坐标不能为负数");

        let result = capture_pixel(0, -1, None);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "坐标不能为负数");
    }

    #[test]
    fn test_capture_fullscreen_command_signature() {
        // 验证函数签名：Option<u32> → Result
        let _f: fn(Option<u32>) -> Result<ScreenshotResult, String> = capture_fullscreen;
    }

    #[test]
    fn test_capture_pixel_command_signature() {
        let _f: fn(i32, i32, Option<u32>) -> Result<RgbColor, String> = capture_pixel;
    }

    #[test]
    fn test_capture_region_command_signature() {
        let _f: fn(CaptureRegion, Option<u32>) -> Result<ScreenshotResult, String> = capture_region;
    }

    #[test]
    fn test_monitor_count_command_signature() {
        let _f: fn() -> Result<usize, String> = monitor_count;
    }

    #[test]
    fn test_list_monitors_command_signature() {
        let _f: fn() -> Result<Vec<MonitorInfo>, String> = list_monitors;
    }

    #[test]
    fn test_capture_fullscreen_accepts_none() {
        // None 应等价于"取主显示器"，调用签名正确即可（实际截图依赖运行环境）
        let _ = capture_fullscreen(None);
    }

    #[test]
    fn test_capture_fullscreen_accepts_some_id() {
        // 指定 id 调用签名正确（实际匹配依赖运行环境）
        let _ = capture_fullscreen(Some(999));
    }
}
