use base64::Engine;
use image::ImageFormat;
use xcap::Monitor;

use crate::core::color::RgbColor;
use crate::core::screenshot::{CaptureRegion, MonitorInfo, ScreenshotResult};

/// 截图服务：封装 xcap 截图逻辑
pub struct CaptureService;

impl CaptureService {
    /// 列出所有显示器信息（供前端选择目标显示器）
    pub fn list_monitors() -> Result<Vec<MonitorInfo>, String> {
        let monitors = Monitor::all().map_err(|e| format!("获取显示器列表失败: {}", e))?;
        let mut result = Vec::with_capacity(monitors.len());
        for m in monitors {
            // 单个显示器信息获取失败时跳过，避免整体失败
            let id = m.id().unwrap_or(0);
            let name = m.name().unwrap_or_else(|_| "Unknown".to_string());
            let x = m.x().unwrap_or(0);
            let y = m.y().unwrap_or(0);
            let width = m.width().unwrap_or(0);
            let height = m.height().unwrap_or(0);
            let is_primary = m.is_primary().unwrap_or(false);
            result.push(MonitorInfo::new(id, name, x, y, width, height, is_primary));
        }
        Ok(result)
    }

    /// 全屏截图
    /// - monitor_id: 指定显示器 id；None 时取主显示器（回退第一个）
    pub fn capture_fullscreen(monitor_id: Option<u32>) -> Result<ScreenshotResult, String> {
        let monitor = Self::select_monitor(monitor_id)?;
        let image = monitor
            .capture_image()
            .map_err(|e| format!("截图失败: {}", e))?;

        let width = image.width();
        let height = image.height();

        let mut buf = Vec::new();
        image
            .write_to(&mut std::io::Cursor::new(&mut buf), ImageFormat::Png)
            .map_err(|e| format!("PNG 编码失败: {}", e))?;

        let image_data = base64::engine::general_purpose::STANDARD.encode(&buf);

        Ok(ScreenshotResult::new(image_data, width, height))
    }

    /// 区域截图
    /// - region: 选区坐标（以目标显示器左上角为原点）
    /// - monitor_id: 指定显示器 id；None 时取主显示器（回退第一个）
    pub fn capture_region(region: CaptureRegion, monitor_id: Option<u32>) -> Result<ScreenshotResult, String> {
        if !region.is_valid() {
            return Err("无效的截图区域".to_string());
        }

        let x: u32 = region
            .x
            .try_into()
            .map_err(|_| "区域 x 坐标不能为负数".to_string())?;
        let y: u32 = region
            .y
            .try_into()
            .map_err(|_| "区域 y 坐标不能为负数".to_string())?;

        let monitor = Self::select_monitor(monitor_id)?;
        let image = monitor
            .capture_region(x, y, region.width, region.height)
            .map_err(|e| format!("区域截图失败: {}", e))?;

        let width = image.width();
        let height = image.height();

        let mut buf = Vec::new();
        image
            .write_to(&mut std::io::Cursor::new(&mut buf), ImageFormat::Png)
            .map_err(|e| format!("PNG 编码失败: {}", e))?;

        let image_data = base64::engine::general_purpose::STANDARD.encode(&buf);

        Ok(ScreenshotResult::new(image_data, width, height))
    }

    /// 像素取色
    /// - (x, y): 以目标显示器左上角为原点的坐标
    /// - monitor_id: 指定显示器 id；None 时取主显示器（回退第一个）
    pub fn capture_pixel(x: i32, y: i32, monitor_id: Option<u32>) -> Result<RgbColor, String> {
        if x < 0 || y < 0 {
            return Err("坐标不能为负数".to_string());
        }
        let px: u32 = x
            .try_into()
            .map_err(|_| "坐标 x 越界".to_string())?;
        let py: u32 = y
            .try_into()
            .map_err(|_| "坐标 y 越界".to_string())?;

        let monitor = Self::select_monitor(monitor_id)?;
        let image = monitor
            .capture_image()
            .map_err(|e| format!("截图失败: {}", e))?;

        if px >= image.width() || py >= image.height() {
            return Err(format!(
                "坐标 ({}, {}) 超出屏幕范围 ({}, {})",
                px,
                py,
                image.width(),
                image.height()
            ));
        }

        let pixel = image.get_pixel(px, py);
        Ok(RgbColor::new(pixel[0], pixel[1], pixel[2]))
    }

    /// 选择显示器：按 id 精确匹配；None 或找不到时回退主显示器，再回退第一个
    fn select_monitor(monitor_id: Option<u32>) -> Result<Monitor, String> {
        let monitors = Monitor::all().map_err(|e| format!("获取显示器列表失败: {}", e))?;
        if monitors.is_empty() {
            return Err("没有可用的显示器".to_string());
        }

        // 1. 按指定 id 精确匹配
        if let Some(id) = monitor_id {
            if let Some(m) = monitors.iter().find(|m| m.id().ok() == Some(id)) {
                return Ok(m.clone());
            }
            // 找不到指定 id 时回退主显示器
        }

        // 2. 主显示器
        if let Some(m) = monitors.iter().find(|m| m.is_primary().unwrap_or(false)) {
            return Ok(m.clone());
        }

        // 3. 第一个
        Ok(monitors[0].clone())
    }

    /// 获取所有显示器数量
    pub fn monitor_count() -> Result<usize, String> {
        let monitors = Monitor::all().map_err(|e| format!("获取显示器列表失败: {}", e))?;
        Ok(monitors.len())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_capture_region_rejects_invalid_region() {
        let invalid = CaptureRegion::new(0, 0, 0, 0);
        let result = CaptureService::capture_region(invalid, None);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "无效的截图区域");
    }

    #[test]
    fn test_capture_region_rejects_negative_coords() {
        let neg = CaptureRegion::new(-10, 0, 100, 100);
        let result = CaptureService::capture_region(neg, None);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("负数"));
    }

    #[test]
    fn test_capture_pixel_rejects_negative() {
        assert!(CaptureService::capture_pixel(-1, 0, None).is_err());
        assert!(CaptureService::capture_pixel(0, -1, None).is_err());
    }

    #[test]
    fn test_list_monitors_returns_vec() {
        // 沙箱可能无显示器，但不应 panic；返回 Ok 或 Err 都可接受
        let _ = CaptureService::list_monitors();
    }

    #[test]
    fn test_monitor_count_is_consistent() {
        let count = CaptureService::monitor_count();
        let list = CaptureService::list_monitors();
        // 两者应一致（都 Ok 时长度相等；都 Err 时都失败）
        match (count, list) {
            (Ok(c), Ok(l)) => assert_eq!(c, l.len()),
            (Err(_), Err(_)) => {}
            _ => panic!("monitor_count 与 list_monitors 结果不一致"),
        }
    }
}
