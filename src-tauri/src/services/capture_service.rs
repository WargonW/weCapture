use base64::Engine;
use image::ImageFormat;
use xcap::Monitor;

use crate::core::screenshot::{CaptureRegion, ScreenshotResult};

/// 截图服务：封装 xcap 截图逻辑
pub struct CaptureService;

impl CaptureService {
    /// 采集主显示器全屏截图，返回 Base64 PNG
    pub fn capture_fullscreen() -> Result<ScreenshotResult, String> {
        let monitors = Monitor::all().map_err(|e| format!("获取显示器列表失败: {}", e))?;
        let monitor = monitors
            .into_iter()
            .find(|m| m.is_primary().unwrap_or(false))
            .or_else(|| {
                // 如果找不到主显示器，取第一个
                Monitor::all().ok()?.into_iter().next()
            })
            .ok_or("没有可用的显示器")?;

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

    /// 采集指定区域的截图
    pub fn capture_region(region: CaptureRegion) -> Result<ScreenshotResult, String> {
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

        let monitors = Monitor::all().map_err(|e| format!("获取显示器列表失败: {}", e))?;
        let monitor = monitors
            .into_iter()
            .find(|m| m.is_primary().unwrap_or(false))
            .or_else(|| {
                Monitor::all().ok()?.into_iter().next()
            })
            .ok_or("没有可用的显示器")?;

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

    /// 获取所有显示器数量
    pub fn monitor_count() -> Result<usize, String> {
        let monitors = Monitor::all().map_err(|e| format!("获取显示器列表失败: {}", e))?;
        Ok(monitors.len())
    }
}
