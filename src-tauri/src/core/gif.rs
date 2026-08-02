use std::fs::File;
use std::io::Write;

use gif::{Encoder, Frame, Repeat};

/// GIF 编码器封装：逐帧写入 RGBA → 自动量化调色板
pub struct GifEncoder<W: Write> {
    encoder: Encoder<W>,
    width: u16,
    height: u16,
}

impl<W: Write> GifEncoder<W> {
    /// 创建编码器
    /// - width/height: 所有帧的统一尺寸（调用方负责降采样到该尺寸）
    pub fn new(writer: W, width: u32, height: u32) -> Result<Self, String> {
        if width == 0 || height == 0 {
            return Err(format!("GIF 尺寸非法: {}x{}", width, height));
        }
        let w: u16 = width
            .try_into()
            .map_err(|_| format!("GIF 宽度超限: {}", width))?;
        let h: u16 = height
            .try_into()
            .map_err(|_| format!("GIF 高度超限: {}", height))?;
        let mut encoder = Encoder::new(writer, w, h, &[])
            .map_err(|e| format!("创建 GIF 编码器失败: {}", e))?;
        encoder
            .set_repeat(Repeat::Infinite)
            .map_err(|e| format!("设置 GIF 循环失败: {}", e))?;
        Ok(Self {
            encoder,
            width: w,
            height: h,
        })
    }

    /// 写入一帧
    /// - rgba: RGBA 像素数据（长度需 = width × height × 4）
    /// - delay_ms: 该帧展示时长（毫秒），GIF 精度为 1/100s，会四舍五入
    pub fn write_frame(&mut self, rgba: Vec<u8>, delay_ms: u32) -> Result<(), String> {
        let expected = (self.width as usize) * (self.height as usize) * 4;
        if rgba.len() < expected {
            return Err(format!(
                "RGBA 数据不足: {} < {}",
                rgba.len(),
                expected
            ));
        }
        let mut rgba = rgba;
        rgba.truncate(expected);
        // GIF delay 单位 1/100 秒
        let delay = (delay_ms / 10).min(u16::MAX as u32) as u16;
        let mut frame = Frame::from_rgba_speed(self.width, self.height, &mut rgba, 10);
        frame.delay = delay;
        self.encoder
            .write_frame(&frame)
            .map_err(|e| format!("写入 GIF 帧失败: {}", e))
    }
}

impl GifEncoder<File> {
    /// 从文件路径创建
    pub fn from_path(path: &str, width: u32, height: u32) -> Result<Self, String> {
        let file = File::create(path).map_err(|e| format!("创建 GIF 文件失败: {}", e))?;
        Self::new(file, width, height)
    }
}

/// 将 RGBA 帧降采样到目标宽度（等比缩放，最近邻插值）
/// - 返回 (降采样后 RGBA, 实际宽度, 实际高度)
pub fn downsample_rgba(
    rgba: &[u8],
    src_w: u32,
    src_h: u32,
    max_width: u32,
) -> Result<(Vec<u8>, u32, u32), String> {
    if src_w == 0 || src_h == 0 {
        return Err(format!("源尺寸非法: {}x{}", src_w, src_h));
    }
    if max_width == 0 {
        return Err("目标宽度不能为 0".to_string());
    }
    let expected = (src_w as usize) * (src_h as usize) * 4;
    if rgba.len() < expected {
        return Err(format!(
            "RGBA 数据不足: {} < {}",
            rgba.len(),
            expected
        ));
    }

    // 无需缩放
    if src_w <= max_width {
        return Ok((rgba[..expected].to_vec(), src_w, src_h));
    }

    let dst_w = max_width;
    // 等比缩放，高度按比例
    let dst_h = ((src_h as u64 * dst_w as u64) / src_w as u64) as u32;
    let dst_h = dst_h.max(1);

    let mut out = vec![0u8; (dst_w as usize) * (dst_h as usize) * 4];
    // 最近邻：每个目标像素取源图对应位置
    let x_ratio = src_w as f64 / dst_w as f64;
    let y_ratio = src_h as f64 / dst_h as f64;
    for dy in 0..dst_h {
        let sy = ((dy as f64) * y_ratio) as usize;
        let sy = sy.min(src_h as usize - 1);
        for dx in 0..dst_w {
            let sx = ((dx as f64) * x_ratio) as usize;
            let sx = sx.min(src_w as usize - 1);
            let src_idx = (sy * src_w as usize + sx) * 4;
            let dst_idx = (dy as usize * dst_w as usize + dx as usize) * 4;
            out[dst_idx..dst_idx + 4].copy_from_slice(&rgba[src_idx..src_idx + 4]);
        }
    }
    Ok((out, dst_w, dst_h))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    #[test]
    fn test_gif_encoder_create() {
        let buf = Cursor::new(Vec::new());
        let enc = GifEncoder::new(buf, 100, 100);
        assert!(enc.is_ok());
    }

    #[test]
    fn test_gif_encoder_rejects_zero_size() {
        let buf = Cursor::new(Vec::new());
        assert!(GifEncoder::new(buf, 0, 100).is_err());
        assert!(GifEncoder::new(Cursor::new(Vec::new()), 100, 0).is_err());
    }

    #[test]
    fn test_gif_encoder_write_frame() {
        let buf = Cursor::new(Vec::new());
        let mut enc = GifEncoder::new(buf, 2, 2).unwrap();
        // 2x2 RGBA
        let rgba = vec![255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 0, 255];
        let result = enc.write_frame(rgba, 100);
        assert!(result.is_ok());
    }

    #[test]
    fn test_gif_encoder_rejects_short_rgba() {
        let buf = Cursor::new(Vec::new());
        let mut enc = GifEncoder::new(buf, 4, 4).unwrap();
        // 4x4 需要 64 字节，只给 10
        let rgba = vec![0u8; 10];
        assert!(enc.write_frame(rgba, 100).is_err());
    }

    #[test]
    fn test_gif_encoder_multiple_frames() {
        let buf = Cursor::new(Vec::new());
        let mut enc = GifEncoder::new(buf, 2, 2).unwrap();
        let frame = vec![255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 0, 255];
        assert!(enc.write_frame(frame.clone(), 50).is_ok());
        // 第二帧不同颜色
        let frame2 = vec![0, 0, 255, 255, 255, 0, 0, 255, 0, 255, 0, 255, 128, 128, 128, 255];
        assert!(enc.write_frame(frame2, 100).is_ok());
    }

    #[test]
    fn test_downsample_no_resize_needed() {
        // 4x2，max_width=4，无需缩放
        let rgba = vec![0u8; 4 * 2 * 4];
        let (out, w, h) = downsample_rgba(&rgba, 4, 2, 4).unwrap();
        assert_eq!(w, 4);
        assert_eq!(h, 2);
        assert_eq!(out.len(), 4 * 2 * 4);
    }

    #[test]
    fn test_downsample_halves_width() {
        // 8x4 → max_width=4 → 4x2
        let rgba = vec![255u8; 8 * 4 * 4];
        let (out, w, h) = downsample_rgba(&rgba, 8, 4, 4).unwrap();
        assert_eq!(w, 4);
        assert_eq!(h, 2);
        assert_eq!(out.len(), 4 * 2 * 4);
    }

    #[test]
    fn test_downsample_preserves_color() {
        // 4x2 全红，缩放到 2x1，应仍为红色
        let rgba: Vec<u8> = [255u8, 0, 0, 255].repeat(8);
        let (out, w, h) = downsample_rgba(&rgba, 4, 2, 2).unwrap();
        assert_eq!(w, 2);
        assert_eq!(h, 1);
        // 所有像素应为红色
        for chunk in out.chunks(4) {
            assert_eq!(chunk, &[255, 0, 0, 255]);
        }
    }

    #[test]
    fn test_downsample_rejects_zero_src() {
        let rgba = vec![];
        assert!(downsample_rgba(&rgba, 0, 10, 100).is_err());
        assert!(downsample_rgba(&rgba, 10, 0, 100).is_err());
    }

    #[test]
    fn test_downsample_rejects_zero_max_width() {
        let rgba = vec![0u8; 4 * 4 * 4];
        assert!(downsample_rgba(&rgba, 4, 4, 0).is_err());
    }

    #[test]
    fn test_downsample_rejects_short_rgba() {
        // 4x4 需要 64 字节，只给 10
        let rgba = vec![0u8; 10];
        assert!(downsample_rgba(&rgba, 4, 4, 2).is_err());
    }

    #[test]
    fn test_gif_file_creates_valid_header() {
        // 写入临时文件验证 GIF 文件头
        let path = "/tmp/snapmaster_gif_test.gif";
        let mut enc = GifEncoder::from_path(path, 2, 2).unwrap();
        let rgba = vec![255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 0, 255];
        enc.write_frame(rgba, 100).unwrap();
        drop(enc);
        let bytes = std::fs::read(path).unwrap();
        // GIF 文件以 "GIF89a" 开头
        assert_eq!(&bytes[..6], b"GIF89a");
        let _ = std::fs::remove_file(path);
    }
}
