use serde::{Deserialize, Serialize};

/// 截图模式
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CaptureMode {
    /// 全屏截图
    Fullscreen,
    /// 区域截图
    Region,
    /// 窗口截图
    Window,
}

/// 截图选区：以左上角为原点的矩形区域
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureRegion {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

impl CaptureRegion {
    pub fn new(x: i32, y: i32, width: u32, height: u32) -> Self {
        Self { x, y, width, height }
    }

    /// 从两个点（拖拽起点和终点）计算选区
    pub fn from_points(x1: i32, y1: i32, x2: i32, y2: i32) -> Self {
        let x = x1.min(x2);
        let y = y1.min(y2);
        let width = (x1.max(x2) - x).max(1) as u32;
        let height = (y1.max(y2) - y).max(1) as u32;
        Self { x, y, width, height }
    }

    /// 判断选区是否有效（宽高都大于 0）
    pub fn is_valid(&self) -> bool {
        self.width > 0 && self.height > 0
    }

    /// 选区面积
    pub fn area(&self) -> u64 {
        self.width as u64 * self.height as u64
    }

    /// 判断点是否在选区内
    pub fn contains(&self, px: i32, py: i32) -> bool {
        px >= self.x
            && px < self.x + self.width as i32
            && py >= self.y
            && py < self.y + self.height as i32
    }
}

/// 截图结果
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenshotResult {
    /// Base64 编码的 PNG 图片数据
    pub image_data: String,
    /// 图片宽度
    pub width: u32,
    /// 图片高度
    pub height: u32,
}

impl ScreenshotResult {
    pub fn new(image_data: String, width: u32, height: u32) -> Self {
        Self { image_data, width, height }
    }

    /// 生成 data URL（可直接用于前端 <img src>）
    pub fn to_data_url(&self) -> String {
        format!("data:image/png;base64,{}", self.image_data)
    }
}

/// 显示器信息（跨平台抽象，供前端选择目标显示器）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MonitorInfo {
    /// 显示器唯一标识（xcap 内部 id）
    pub id: u32,
    /// 显示器名称（系统报告的名称）
    pub name: String,
    /// 在虚拟桌面中的左上角 X 坐标
    pub x: i32,
    /// 在虚拟桌面中的左上角 Y 坐标
    pub y: i32,
    /// 分辨率宽度（物理像素）
    pub width: u32,
    /// 分辨率高度（物理像素）
    pub height: u32,
    /// 是否为主显示器
    pub is_primary: bool,
}

impl MonitorInfo {
    pub fn new(id: u32, name: String, x: i32, y: i32, width: u32, height: u32, is_primary: bool) -> Self {
        Self {
            id,
            name,
            x,
            y,
            width,
            height,
            is_primary,
        }
    }

    /// 判断虚拟桌面坐标 (px, py) 是否落在该显示器范围内
    pub fn contains_point(&self, px: i32, py: i32) -> bool {
        px >= self.x
            && px < self.x + self.width as i32
            && py >= self.y
            && py < self.y + self.height as i32
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_capture_region_new() {
        let region = CaptureRegion::new(100, 200, 300, 400);
        assert_eq!(region.x, 100);
        assert_eq!(region.y, 200);
        assert_eq!(region.width, 300);
        assert_eq!(region.height, 400);
    }

    #[test]
    fn test_from_points_normal() {
        let region = CaptureRegion::from_points(100, 100, 300, 200);
        assert_eq!(region.x, 100);
        assert_eq!(region.y, 100);
        assert_eq!(region.width, 200);
        assert_eq!(region.height, 100);
    }

    #[test]
    fn test_from_points_reversed() {
        // 终点在起点左上方
        let region = CaptureRegion::from_points(300, 200, 100, 100);
        assert_eq!(region.x, 100);
        assert_eq!(region.y, 100);
        assert_eq!(region.width, 200);
        assert_eq!(region.height, 100);
    }

    #[test]
    fn test_from_points_same_point() {
        // 起点终点相同，宽高至少为 1
        let region = CaptureRegion::from_points(100, 100, 100, 100);
        assert_eq!(region.width, 1);
        assert_eq!(region.height, 1);
    }

    #[test]
    fn test_is_valid() {
        assert!(CaptureRegion::new(0, 0, 100, 100).is_valid());
        assert!(!CaptureRegion::new(0, 0, 0, 100).is_valid());
        assert!(!CaptureRegion::new(0, 0, 100, 0).is_valid());
    }

    #[test]
    fn test_area() {
        assert_eq!(CaptureRegion::new(0, 0, 100, 200).area(), 20000);
        assert_eq!(CaptureRegion::new(0, 0, 1, 1).area(), 1);
    }

    #[test]
    fn test_contains() {
        let region = CaptureRegion::new(100, 100, 200, 200);
        assert!(region.contains(150, 150));
        assert!(region.contains(100, 100)); // 左上角包含
        assert!(!region.contains(300, 100)); // 右边界外
        assert!(!region.contains(100, 300)); // 下边界外
        assert!(!region.contains(50, 150)); // 左边界外
    }

    #[test]
    fn test_screenshot_result_to_data_url() {
        let result = ScreenshotResult::new("iVBORw0KGgo=".to_string(), 100, 200);
        assert_eq!(result.to_data_url(), "data:image/png;base64,iVBORw0KGgo=");
    }

    #[test]
    fn test_capture_mode_serde() {
        let mode = CaptureMode::Region;
        let json = serde_json::to_string(&mode).unwrap();
        assert_eq!(json, "\"Region\"");
        let deserialized: CaptureMode = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized, CaptureMode::Region);
    }

    // ===== MonitorInfo 测试 =====

    #[test]
    fn test_monitor_info_new() {
        let m = MonitorInfo::new(1, "Display 1".to_string(), 0, 0, 1920, 1080, true);
        assert_eq!(m.id, 1);
        assert_eq!(m.name, "Display 1");
        assert_eq!(m.x, 0);
        assert_eq!(m.y, 0);
        assert_eq!(m.width, 1920);
        assert_eq!(m.height, 1080);
        assert!(m.is_primary);
    }

    #[test]
    fn test_monitor_info_contains_point_inside() {
        let m = MonitorInfo::new(1, "Main".to_string(), 0, 0, 1920, 1080, true);
        // 左上角
        assert!(m.contains_point(0, 0));
        // 内部点
        assert!(m.contains_point(100, 100));
        // 右下角内侧（边界 = width-1）
        assert!(m.contains_point(1919, 1079));
    }

    #[test]
    fn test_monitor_info_contains_point_outside() {
        let m = MonitorInfo::new(1, "Main".to_string(), 0, 0, 1920, 1080, true);
        // 右边界外
        assert!(!m.contains_point(1920, 0));
        // 下边界外
        assert!(!m.contains_point(0, 1080));
        // 负坐标
        assert!(!m.contains_point(-1, -1));
    }

    #[test]
    fn test_monitor_info_contains_point_secondary_monitor() {
        // 副显示器在主显示器右侧：x=1920
        let m = MonitorInfo::new(2, "Secondary".to_string(), 1920, 0, 1920, 1080, false);
        // 副屏内部
        assert!(m.contains_point(2000, 500));
        // 主屏区域不属于副屏
        assert!(!m.contains_point(1000, 500));
    }

    #[test]
    fn test_monitor_info_serde() {
        let m = MonitorInfo::new(2, "HDMI-1".to_string(), -1920, 0, 1920, 1080, false);
        let json = serde_json::to_string(&m).unwrap();
        // camelCase 字段名
        assert!(json.contains("\"isPrimary\":false"));
        assert!(json.contains("\"id\":2"));
        let de: MonitorInfo = serde_json::from_str(&json).unwrap();
        assert_eq!(de.id, 2);
        assert_eq!(de.x, -1920);
        assert!(!de.is_primary);
    }
}
