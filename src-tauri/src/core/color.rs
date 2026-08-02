use serde::{Deserialize, Serialize};

/// RGB 颜色值
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RgbColor {
    pub r: u8,
    pub g: u8,
    pub b: u8,
}

impl RgbColor {
    pub fn new(r: u8, g: u8, b: u8) -> Self {
        Self { r, g, b }
    }

    /// 转为 #RRGGBB 格式（大写）
    pub fn to_hex(&self) -> String {
        format!("#{:02X}{:02X}{:02X}", self.r, self.g, self.b)
    }

    /// 转为 rgb(r,g,b) 格式
    pub fn to_rgb_string(&self) -> String {
        format!("rgb({},{},{})", self.r, self.g, self.b)
    }

    /// 从 #RRGGBB 解析（支持大小写，可选 #）
    pub fn from_hex(hex: &str) -> Option<Self> {
        let s = hex.trim_start_matches('#');
        if s.len() != 6 {
            return None;
        }
        let r = u8::from_str_radix(&s[0..2], 16).ok()?;
        let g = u8::from_str_radix(&s[2..4], 16).ok()?;
        let b = u8::from_str_radix(&s[4..6], 16).ok()?;
        Some(Self { r, g, b })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new() {
        let c = RgbColor::new(255, 128, 0);
        assert_eq!(c.r, 255);
        assert_eq!(c.g, 128);
        assert_eq!(c.b, 0);
    }

    #[test]
    fn test_to_hex() {
        assert_eq!(RgbColor::new(255, 0, 0).to_hex(), "#FF0000");
        assert_eq!(RgbColor::new(0, 255, 0).to_hex(), "#00FF00");
        assert_eq!(RgbColor::new(0, 0, 255).to_hex(), "#0000FF");
        assert_eq!(RgbColor::new(255, 255, 255).to_hex(), "#FFFFFF");
        assert_eq!(RgbColor::new(0, 0, 0).to_hex(), "#000000");
        assert_eq!(RgbColor::new(18, 52, 86).to_hex(), "#123456");
    }

    #[test]
    fn test_to_rgb_string() {
        assert_eq!(RgbColor::new(255, 0, 0).to_rgb_string(), "rgb(255,0,0)");
        assert_eq!(RgbColor::new(18, 52, 86).to_rgb_string(), "rgb(18,52,86)");
    }

    #[test]
    fn test_from_hex_valid() {
        assert_eq!(RgbColor::from_hex("#FF0000"), Some(RgbColor::new(255, 0, 0)));
        assert_eq!(RgbColor::from_hex("#ff0000"), Some(RgbColor::new(255, 0, 0)));
        assert_eq!(RgbColor::from_hex("FF0000"), Some(RgbColor::new(255, 0, 0)));
        assert_eq!(RgbColor::from_hex("#123456"), Some(RgbColor::new(18, 52, 86)));
    }

    #[test]
    fn test_from_hex_invalid() {
        assert_eq!(RgbColor::from_hex("#FFF"), None); // 太短
        assert_eq!(RgbColor::from_hex("#GGGGGG"), None); // 非法字符
        assert_eq!(RgbColor::from_hex(""), None);
        assert_eq!(RgbColor::from_hex("#12345"), None); // 5 位
    }

    #[test]
    fn test_hex_roundtrip() {
        let c = RgbColor::new(123, 45, 67);
        let hex = c.to_hex();
        assert_eq!(RgbColor::from_hex(&hex), Some(c));
    }

    #[test]
    fn test_serde() {
        let c = RgbColor::new(255, 128, 0);
        let json = serde_json::to_string(&c).unwrap();
        assert!(json.contains("\"r\":255"));
        assert!(json.contains("\"g\":128"));
        assert!(json.contains("\"b\":0"));
        let c2: RgbColor = serde_json::from_str(&json).unwrap();
        assert_eq!(c, c2);
    }
}
