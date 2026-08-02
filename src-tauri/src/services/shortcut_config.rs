use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

/// store 文件名
pub const STORE_FILE: &str = "config.json";
/// store 中快捷键配置的 key
pub const STORE_KEY: &str = "shortcuts";

/// 快捷键对应的动作
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ShortcutAction {
    Screenshot,
    Recorder,
    Pin,
    ColorPicker,
}

impl ShortcutAction {
    /// 转为字符串标识
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Screenshot => "screenshot",
            Self::Recorder => "recorder",
            Self::Pin => "pin",
            Self::ColorPicker => "color-picker",
        }
    }

    /// 从字符串解析
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "screenshot" => Some(Self::Screenshot),
            "recorder" => Some(Self::Recorder),
            "pin" => Some(Self::Pin),
            "color-picker" => Some(Self::ColorPicker),
            _ => None,
        }
    }

    /// 全部动作
    pub fn all() -> &'static [ShortcutAction] {
        &[Self::Screenshot, Self::Recorder, Self::Pin, Self::ColorPicker]
    }
}

/// 快捷键配置（4 个功能的快捷键映射）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShortcutConfig {
    pub screenshot: String,
    pub recorder: String,
    pub pin: String,
    #[serde(rename = "color-picker")]
    pub color_picker: String,
}

impl Default for ShortcutConfig {
    fn default() -> Self {
        Self {
            screenshot: "Ctrl+Shift+S".to_string(),
            recorder: "Ctrl+Shift+R".to_string(),
            pin: "Ctrl+Shift+P".to_string(),
            color_picker: "Ctrl+Shift+C".to_string(),
        }
    }
}

impl ShortcutConfig {
    /// 获取指定动作的快捷键
    pub fn get(&self, action: ShortcutAction) -> &str {
        match action {
            ShortcutAction::Screenshot => &self.screenshot,
            ShortcutAction::Recorder => &self.recorder,
            ShortcutAction::Pin => &self.pin,
            ShortcutAction::ColorPicker => &self.color_picker,
        }
    }

    /// 设置指定动作的快捷键
    pub fn set(&mut self, action: ShortcutAction, value: String) {
        match action {
            ShortcutAction::Screenshot => self.screenshot = value,
            ShortcutAction::Recorder => self.recorder = value,
            ShortcutAction::Pin => self.pin = value,
            ShortcutAction::ColorPicker => self.color_picker = value,
        }
    }

    /// 转为 action->shortcut 的 map
    pub fn to_map(&self) -> HashMap<String, String> {
        let mut m = HashMap::new();
        for a in ShortcutAction::all() {
            m.insert(a.as_str().to_string(), self.get(*a).to_string());
        }
        m
    }

    /// 从 map 构造，缺失字段回退默认值
    pub fn from_map(map: &HashMap<String, String>) -> Self {
        let d = Self::default();
        Self {
            screenshot: map.get("screenshot").cloned().unwrap_or(d.screenshot),
            recorder: map.get("recorder").cloned().unwrap_or(d.recorder),
            pin: map.get("pin").cloned().unwrap_or(d.pin),
            color_picker: map.get("color-picker").cloned().unwrap_or(d.color_picker),
        }
    }

    /// 从 store 读取配置，失败或缺失返回默认值
    pub fn load(app: &AppHandle) -> Self {
        let store = match app.store(STORE_FILE) {
            Ok(s) => s,
            Err(_) => return Self::default(),
        };
        match store.get(STORE_KEY) {
            Some(val) => {
                if let Ok(map) = serde_json::from_value::<HashMap<String, String>>(val) {
                    Self::from_map(&map)
                } else {
                    Self::default()
                }
            }
            None => Self::default(),
        }
    }

    /// 保存配置到 store 并持久化
    pub fn save(&self, app: &AppHandle) -> Result<(), String> {
        let store = app
            .store(STORE_FILE)
            .map_err(|e| format!("打开 store 失败: {}", e))?;
        let val = serde_json::to_value(self.to_map()).map_err(|e| format!("序列化失败: {}", e))?;
        store.set(STORE_KEY, val);
        store.save().map_err(|e| format!("保存 store 失败: {}", e))?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_values() {
        let c = ShortcutConfig::default();
        assert_eq!(c.screenshot, "Ctrl+Shift+S");
        assert_eq!(c.recorder, "Ctrl+Shift+R");
        assert_eq!(c.pin, "Ctrl+Shift+P");
        assert_eq!(c.color_picker, "Ctrl+Shift+C");
    }

    #[test]
    fn test_action_as_str() {
        assert_eq!(ShortcutAction::Screenshot.as_str(), "screenshot");
        assert_eq!(ShortcutAction::Recorder.as_str(), "recorder");
        assert_eq!(ShortcutAction::Pin.as_str(), "pin");
        assert_eq!(ShortcutAction::ColorPicker.as_str(), "color-picker");
    }

    #[test]
    fn test_action_from_str() {
        assert_eq!(ShortcutAction::from_str("screenshot"), Some(ShortcutAction::Screenshot));
        assert_eq!(ShortcutAction::from_str("color-picker"), Some(ShortcutAction::ColorPicker));
        assert_eq!(ShortcutAction::from_str("unknown"), None);
    }

    #[test]
    fn test_action_all_count() {
        assert_eq!(ShortcutAction::all().len(), 4);
    }

    #[test]
    fn test_get_and_set() {
        let mut c = ShortcutConfig::default();
        assert_eq!(c.get(ShortcutAction::Screenshot), "Ctrl+Shift+S");
        c.set(ShortcutAction::Screenshot, "Ctrl+Alt+S".to_string());
        assert_eq!(c.get(ShortcutAction::Screenshot), "Ctrl+Alt+S");
        // 其他不受影响
        assert_eq!(c.get(ShortcutAction::Recorder), "Ctrl+Shift+R");
    }

    #[test]
    fn test_to_map() {
        let c = ShortcutConfig::default();
        let m = c.to_map();
        assert_eq!(m.get("screenshot"), Some(&"Ctrl+Shift+S".to_string()));
        assert_eq!(m.get("color-picker"), Some(&"Ctrl+Shift+C".to_string()));
        assert_eq!(m.len(), 4);
    }

    #[test]
    fn test_from_map_full() {
        let mut m = HashMap::new();
        m.insert("screenshot".to_string(), "Ctrl+Alt+S".to_string());
        m.insert("recorder".to_string(), "Ctrl+Alt+R".to_string());
        m.insert("pin".to_string(), "Ctrl+Alt+P".to_string());
        m.insert("color-picker".to_string(), "Ctrl+Alt+C".to_string());
        let c = ShortcutConfig::from_map(&m);
        assert_eq!(c.screenshot, "Ctrl+Alt+S");
        assert_eq!(c.color_picker, "Ctrl+Alt+C");
    }

    #[test]
    fn test_from_map_missing_field_falls_back_to_default() {
        let mut m = HashMap::new();
        m.insert("screenshot".to_string(), "Ctrl+Alt+S".to_string());
        // 缺少 recorder/pin/color-picker
        let c = ShortcutConfig::from_map(&m);
        assert_eq!(c.screenshot, "Ctrl+Alt+S");
        assert_eq!(c.recorder, "Ctrl+Shift+R"); // 默认值
        assert_eq!(c.pin, "Ctrl+Shift+P");
        assert_eq!(c.color_picker, "Ctrl+Shift+C");
    }

    #[test]
    fn test_from_map_empty_returns_default() {
        let m = HashMap::new();
        let c = ShortcutConfig::from_map(&m);
        assert_eq!(c.screenshot, "Ctrl+Shift+S");
        assert_eq!(c.recorder, "Ctrl+Shift+R");
    }

    #[test]
    fn test_serialize_deserialize_roundtrip() {
        let c = ShortcutConfig::default();
        let json = serde_json::to_string(&c).unwrap();
        // color-picker 字段应为 kebab-case
        assert!(json.contains("\"color-picker\""));
        let c2: ShortcutConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(c2.screenshot, c.screenshot);
        assert_eq!(c2.color_picker, c.color_picker);
    }
}
