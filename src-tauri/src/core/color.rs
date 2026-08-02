/// RGB 颜色值
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RgbColor {
    pub r: u8,
    pub g: u8,
    pub b: u8,
}

impl RgbColor {
    pub fn new(r: u8, g: u8, b: u8) -> Self {
        Self { r, g, b }
    }

    /// 转换为 HEX 字符串，如 "#FF8800"
    pub fn to_hex(&self) -> String {
        format!("#{:02X}{:02X}{:02X}", self.r, self.g, self.b)
    }

    /// 从 HEX 字符串解析，支持 "#FF8800" 或 "FF8800"
    pub fn from_hex(hex: &str) -> Result<Self, String> {
        let hex = hex.trim_start_matches('#');
        if hex.len() != 6 {
            return Err(format!("无效的 HEX 颜色长度: {}", hex));
        }
        let r = u8::from_str_radix(&hex[0..2], 16)
            .map_err(|e| format!("解析红色通道失败: {}", e))?;
        let g = u8::from_str_radix(&hex[2..4], 16)
            .map_err(|e| format!("解析绿色通道失败: {}", e))?;
        let b = u8::from_str_radix(&hex[4..6], 16)
            .map_err(|e| format!("解析蓝色通道失败: {}", e))?;
        Ok(Self { r, g, b })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rgb_to_hex() {
        let color = RgbColor::new(255, 136, 0);
        assert_eq!(color.to_hex(), "#FF8800");
    }

    #[test]
    fn test_rgb_to_hex_black() {
        let color = RgbColor::new(0, 0, 0);
        assert_eq!(color.to_hex(), "#000000");
    }

    #[test]
    fn test_rgb_to_hex_white() {
        let color = RgbColor::new(255, 255, 255);
        assert_eq!(color.to_hex(), "#FFFFFF");
    }

    #[test]
    fn test_from_hex_with_hash() {
        let color = RgbColor::from_hex("#FF8800").unwrap();
        assert_eq!(color, RgbColor::new(255, 136, 0));
    }

    #[test]
    fn test_from_hex_without_hash() {
        let color = RgbColor::from_hex("FF8800").unwrap();
        assert_eq!(color, RgbColor::new(255, 136, 0));
    }

    #[test]
    fn test_from_hex_invalid_length() {
        assert!(RgbColor::from_hex("#FF88").is_err());
    }

    #[test]
    fn test_from_hex_invalid_chars() {
        assert!(RgbColor::from_hex("#GG8800").is_err());
    }

    #[test]
    fn test_hex_roundtrip() {
        let original = RgbColor::new(128, 64, 200);
        let hex = original.to_hex();
        let parsed = RgbColor::from_hex(&hex).unwrap();
        assert_eq!(original, parsed);
    }
}
