use serde::{Deserialize, Serialize};

/// 窗口类型，对应前端的 ?window= 参数
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum WindowType {
    Main,
    Capture,
    Recorder,
    ColorPicker,
    Pin,
}

impl WindowType {
    /// 从字符串解析窗口类型
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "main" => Some(Self::Main),
            "capture" => Some(Self::Capture),
            "recorder" => Some(Self::Recorder),
            "color-picker" => Some(Self::ColorPicker),
            "pin" => Some(Self::Pin),
            _ => None,
        }
    }

    /// 转为 URL query 参数
    pub fn to_query(&self) -> &'static str {
        match self {
            Self::Main => "main",
            Self::Capture => "capture",
            Self::Recorder => "recorder",
            Self::ColorPicker => "color-picker",
            Self::Pin => "pin",
        }
    }
}

/// 窗口配置：描述如何创建一个新窗口
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowConfig {
    /// 窗口标签（唯一标识）
    pub label: String,
    /// 窗口类型
    pub window_type: WindowType,
    /// 窗口标题
    pub title: String,
    /// 宽度
    pub width: u32,
    /// 高度
    pub height: u32,
    /// 是否全屏
    pub fullscreen: bool,
    /// 是否置顶
    pub always_on_top: bool,
    /// 是否无边框
    pub decorations: bool,
    /// 是否可调整大小
    pub resizable: bool,
}

impl WindowConfig {
    /// 根据窗口类型生成默认配置
    pub fn from_type(window_type: WindowType) -> Self {
        match &window_type {
            WindowType::Main => Self {
                label: "main".to_string(),
                window_type,
                title: "SnapMaster".to_string(),
                width: 480,
                height: 600,
                fullscreen: false,
                always_on_top: false,
                decorations: true,
                resizable: false,
            },
            WindowType::Capture => Self {
                label: "capture".to_string(),
                window_type,
                title: "截图".to_string(),
                width: 1920,
                height: 1080,
                fullscreen: true,
                always_on_top: false,
                decorations: false,
                resizable: false,
            },
            WindowType::Recorder => Self {
                label: "recorder".to_string(),
                window_type,
                title: "录屏".to_string(),
                width: 1920,
                height: 1080,
                fullscreen: true,
                always_on_top: false,
                decorations: false,
                resizable: true,
            },
            WindowType::ColorPicker => Self {
                label: "color-picker".to_string(),
                window_type,
                title: "取色器".to_string(),
                width: 1920,
                height: 1080,
                fullscreen: true,
                always_on_top: false,
                decorations: false,
                resizable: false,
            },
            WindowType::Pin => Self {
                label: "pin".to_string(),
                window_type,
                title: "贴图".to_string(),
                width: 400,
                height: 300,
                fullscreen: false,
                always_on_top: true,
                decorations: false,
                resizable: true,
            },
        }
    }

    /// 生成带唯一后缀的 label（用于多实例窗口，如多个贴图）
    pub fn with_unique_label(mut self, suffix: &str) -> Self {
        self.label = format!("{}-{}", self.label, suffix);
        self
    }

    /// 生成前端 URL（带 ?window= 参数）
    pub fn to_url(&self) -> String {
        format!("?window={}", self.window_type.to_query())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_window_type_from_str() {
        assert_eq!(WindowType::from_str("main"), Some(WindowType::Main));
        assert_eq!(WindowType::from_str("capture"), Some(WindowType::Capture));
        assert_eq!(WindowType::from_str("recorder"), Some(WindowType::Recorder));
        assert_eq!(WindowType::from_str("color-picker"), Some(WindowType::ColorPicker));
        assert_eq!(WindowType::from_str("pin"), Some(WindowType::Pin));
        assert_eq!(WindowType::from_str("unknown"), None);
    }

    #[test]
    fn test_window_type_to_query() {
        assert_eq!(WindowType::Main.to_query(), "main");
        assert_eq!(WindowType::Capture.to_query(), "capture");
        assert_eq!(WindowType::ColorPicker.to_query(), "color-picker");
    }

    #[test]
    fn test_capture_config_is_fullscreen() {
        let config = WindowConfig::from_type(WindowType::Capture);
        assert!(config.fullscreen);
        assert!(!config.decorations);
        assert!(!config.always_on_top);
    }

    #[test]
    fn test_recorder_config_fullscreen_resizable() {
        let config = WindowConfig::from_type(WindowType::Recorder);
        // 选区阶段全屏无边框可调整，录制阶段前端动态缩小为控制条
        assert!(config.fullscreen);
        assert!(!config.decorations);
        assert!(config.resizable);
        assert!(!config.always_on_top);
    }

    #[test]
    fn test_pin_config_resizable() {
        let config = WindowConfig::from_type(WindowType::Pin);
        assert!(config.resizable);
        assert!(config.always_on_top);
        assert!(!config.decorations);
    }

    #[test]
    fn test_color_picker_config() {
        let config = WindowConfig::from_type(WindowType::ColorPicker);
        // 全屏透明遮罩预览模式
        assert!(config.fullscreen);
        assert!(!config.decorations);
        assert!(!config.always_on_top);
    }

    #[test]
    fn test_main_config() {
        let config = WindowConfig::from_type(WindowType::Main);
        assert!(config.decorations);
        assert!(!config.always_on_top);
        assert!(!config.resizable);
        assert_eq!(config.width, 480);
        assert_eq!(config.height, 600);
    }

    #[test]
    fn test_unique_label() {
        let config = WindowConfig::from_type(WindowType::Pin)
            .with_unique_label("1700000000");
        assert_eq!(config.label, "pin-1700000000");
    }

    #[test]
    fn test_to_url() {
        let config = WindowConfig::from_type(WindowType::Capture);
        assert_eq!(config.to_url(), "?window=capture");
    }
}
