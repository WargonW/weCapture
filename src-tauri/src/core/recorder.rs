use serde::{Deserialize, Serialize};

use crate::core::screenshot::CaptureRegion;

/// 录屏模式
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RecorderMode {
    /// 全屏录屏
    Fullscreen,
    /// 选区录屏
    Region,
}

/// 输出格式
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum OutputFormat {
    /// MP4（H.264 视频 + 可选 Opus 音频）
    Mp4,
    /// GIF 动图（无音频）
    Gif,
}

impl Default for OutputFormat {
    fn default() -> Self {
        Self::Mp4
    }
}

/// 录屏状态机
/// 状态转换：Idle → (start) → Recording → (stop) → Stopped → (reset) → Idle
///                 ↘ (cancel) → Idle
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RecorderState {
    /// 空闲：未开始录制
    Idle,
    /// 录制中
    Recording,
    /// 已停止：录制结束，等待结果处理
    Stopped,
}

/// 录屏配置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecorderConfig {
    /// 帧率（FPS）
    pub fps: u32,
    /// 录制模式
    pub mode: RecorderMode,
    /// 选区模式下的录制区域（全屏模式下忽略）
    pub region: Option<CaptureRegion>,
    /// 输出格式（MP4 或 GIF）
    #[serde(default)]
    pub output_format: OutputFormat,
    /// 是否录制音频（仅 MP4 模式有效，GIF 无音频）
    #[serde(default)]
    pub audio_enabled: bool,
}

impl Default for RecorderConfig {
    fn default() -> Self {
        Self {
            fps: 30,
            mode: RecorderMode::Fullscreen,
            region: None,
            output_format: OutputFormat::Mp4,
            audio_enabled: false,
        }
    }
}

impl RecorderConfig {
    /// 创建全屏配置
    pub fn fullscreen(fps: u32) -> Self {
        Self {
            fps,
            mode: RecorderMode::Fullscreen,
            region: None,
            output_format: OutputFormat::Mp4,
            audio_enabled: false,
        }
    }

    /// 创建选区配置
    pub fn region(fps: u32, region: CaptureRegion) -> Self {
        Self {
            fps,
            mode: RecorderMode::Region,
            region: Some(region),
            output_format: OutputFormat::Mp4,
            audio_enabled: false,
        }
    }

    /// 校验配置是否合法
    pub fn is_valid(&self) -> bool {
        if self.fps == 0 {
            return false;
        }
        match self.mode {
            RecorderMode::Fullscreen => true,
            RecorderMode::Region => self.region.map(|r| r.is_valid()).unwrap_or(false),
        }
    }

    /// 帧间隔（毫秒）
    pub fn frame_interval_ms(&self) -> u64 {
        if self.fps == 0 {
            return 0;
        }
        1000 / self.fps as u64
    }

    /// 是否实际录制音频：仅 MP4 且 audio_enabled 时
    pub fn effective_audio(&self) -> bool {
        self.output_format == OutputFormat::Mp4 && self.audio_enabled
    }

    /// 输出文件扩展名
    pub fn extension(&self) -> &'static str {
        match self.output_format {
            OutputFormat::Mp4 => "mp4",
            OutputFormat::Gif => "gif",
        }
    }
}

/// 录屏状态机
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RecorderStateMachine {
    state: RecorderState,
}

impl RecorderStateMachine {
    pub fn new() -> Self {
        Self {
            state: RecorderState::Idle,
        }
    }

    /// 当前状态
    pub fn state(&self) -> RecorderState {
        self.state
    }

    /// 开始录制：Idle → Recording
    pub fn start(&mut self) -> Result<(), String> {
        match self.state {
            RecorderState::Idle => {
                self.state = RecorderState::Recording;
                Ok(())
            }
            RecorderState::Recording => Err("已经在录制中".to_string()),
            RecorderState::Stopped => Err("请先重置状态再开始录制".to_string()),
        }
    }

    /// 停止录制：Recording → Stopped
    pub fn stop(&mut self) -> Result<(), String> {
        match self.state {
            RecorderState::Recording => {
                self.state = RecorderState::Stopped;
                Ok(())
            }
            RecorderState::Idle => Err("未在录制中".to_string()),
            RecorderState::Stopped => Err("已经停止".to_string()),
        }
    }

    /// 取消录制：Recording → Idle（不产生结果）
    pub fn cancel(&mut self) -> Result<(), String> {
        match self.state {
            RecorderState::Recording => {
                self.state = RecorderState::Idle;
                Ok(())
            }
            RecorderState::Idle => Err("未在录制中".to_string()),
            RecorderState::Stopped => Err("已经停止，无法取消".to_string()),
        }
    }

    /// 重置：Stopped → Idle（结果处理完毕后回到初始态）
    pub fn reset(&mut self) -> Result<(), String> {
        match self.state {
            RecorderState::Stopped => {
                self.state = RecorderState::Idle;
                Ok(())
            }
            RecorderState::Idle => Ok(()),
            RecorderState::Recording => Err("录制中无法重置".to_string()),
        }
    }
}

impl Default for RecorderStateMachine {
    fn default() -> Self {
        Self::new()
    }
}

/// 将 RGBA 像素数据转为 I420（YUV 4:2:0 planar）三平面
/// - `rgba`: 每像素 4 字节 [R, G, B, A]（与 image::RgbaImage 内存布局一致）
/// - 返回 (y_plane, u_plane, v_plane)
pub fn rgba_to_i420(rgba: &[u8], width: usize, height: usize) -> (Vec<u8>, Vec<u8>, Vec<u8>) {
    let mut y = vec![0u8; width * height];
    let uv_w = width / 2;
    let uv_h = height / 2;
    let mut u = vec![0u8; uv_w * uv_h];
    let mut v = vec![0u8; uv_w * uv_h];

    for j in 0..height {
        for i in 0..width {
            let idx = (j * width + i) * 4;
            let r = rgba[idx] as i32;
            let g = rgba[idx + 1] as i32;
            let b = rgba[idx + 2] as i32;
            // BT.601 整数近似（×256）
            let yv = (77 * r + 150 * g + 29 * b + 128) >> 8;
            let y_pos = j * width + i;
            y[y_pos] = yv.clamp(0, 255) as u8;

            // 色度每 2x2 像素采样一次
            if i % 2 == 0 && j % 2 == 0 {
                let uv_idx = (j / 2) * uv_w + (i / 2);
                let cb = (((-43 * r - 85 * g + 128 * b) >> 8) + 128).clamp(0, 255);
                let cr = (((128 * r - 107 * g - 21 * b) >> 8) + 128).clamp(0, 255);
                u[uv_idx] = cb as u8;
                v[uv_idx] = cr as u8;
            }
        }
    }

    (y, u, v)
}

/// 将三个 I420 平面拼接为单个连续 Vec（供 openh264 YUVBuffer::from_vec 使用）
pub fn i420_to_contiguous(y: &[u8], u: &[u8], v: &[u8]) -> Vec<u8> {
    let mut buf = Vec::with_capacity(y.len() + u.len() + v.len());
    buf.extend_from_slice(y);
    buf.extend_from_slice(u);
    buf.extend_from_slice(v);
    buf
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let cfg = RecorderConfig::default();
        assert_eq!(cfg.fps, 30);
        assert_eq!(cfg.mode, RecorderMode::Fullscreen);
        assert!(cfg.region.is_none());
        assert!(cfg.is_valid());
    }

    #[test]
    fn test_fullscreen_config() {
        let cfg = RecorderConfig::fullscreen(60);
        assert_eq!(cfg.fps, 60);
        assert_eq!(cfg.mode, RecorderMode::Fullscreen);
        assert!(cfg.region.is_none());
        assert!(cfg.is_valid());
    }

    #[test]
    fn test_region_config() {
        let region = CaptureRegion::new(100, 100, 800, 600);
        let cfg = RecorderConfig::region(30, region);
        assert_eq!(cfg.fps, 30);
        assert_eq!(cfg.mode, RecorderMode::Region);
        assert!(cfg.region.is_some());
        assert!(cfg.is_valid());
    }

    #[test]
    fn test_invalid_fps() {
        let cfg = RecorderConfig::fullscreen(0);
        assert!(!cfg.is_valid());
    }

    #[test]
    fn test_invalid_region_mode_without_region() {
        // 选区模式但没有 region → 非法
        let cfg = RecorderConfig {
            fps: 30,
            mode: RecorderMode::Region,
            region: None,
            ..Default::default()
        };
        assert!(!cfg.is_valid());
    }

    #[test]
    fn test_invalid_region_mode_with_zero_area() {
        let cfg = RecorderConfig::region(30, CaptureRegion::new(0, 0, 0, 100));
        assert!(!cfg.is_valid());
    }

    #[test]
    fn test_frame_interval_ms() {
        assert_eq!(RecorderConfig::fullscreen(30).frame_interval_ms(), 33);
        assert_eq!(RecorderConfig::fullscreen(60).frame_interval_ms(), 16);
        assert_eq!(RecorderConfig::fullscreen(1).frame_interval_ms(), 1000);
    }

    #[test]
    fn test_frame_interval_zero_fps() {
        let cfg = RecorderConfig {
            fps: 0,
            mode: RecorderMode::Fullscreen,
            region: None,
            ..Default::default()
        };
        assert_eq!(cfg.frame_interval_ms(), 0);
    }

    // ===== 状态机测试 =====

    #[test]
    fn test_state_machine_initial_idle() {
        let sm = RecorderStateMachine::new();
        assert_eq!(sm.state(), RecorderState::Idle);
    }

    #[test]
    fn test_state_machine_start() {
        let mut sm = RecorderStateMachine::new();
        assert!(sm.start().is_ok());
        assert_eq!(sm.state(), RecorderState::Recording);
    }

    #[test]
    fn test_state_machine_start_twice_fails() {
        let mut sm = RecorderStateMachine::new();
        sm.start().unwrap();
        let result = sm.start();
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "已经在录制中");
        assert_eq!(sm.state(), RecorderState::Recording);
    }

    #[test]
    fn test_state_machine_stop() {
        let mut sm = RecorderStateMachine::new();
        sm.start().unwrap();
        assert!(sm.stop().is_ok());
        assert_eq!(sm.state(), RecorderState::Stopped);
    }

    #[test]
    fn test_state_machine_stop_when_idle_fails() {
        let mut sm = RecorderStateMachine::new();
        let result = sm.stop();
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "未在录制中");
    }

    #[test]
    fn test_state_machine_cancel() {
        let mut sm = RecorderStateMachine::new();
        sm.start().unwrap();
        assert!(sm.cancel().is_ok());
        assert_eq!(sm.state(), RecorderState::Idle);
    }

    #[test]
    fn test_state_machine_cancel_when_idle_fails() {
        let mut sm = RecorderStateMachine::new();
        let result = sm.cancel();
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "未在录制中");
    }

    #[test]
    fn test_state_machine_cancel_when_stopped_fails() {
        let mut sm = RecorderStateMachine::new();
        sm.start().unwrap();
        sm.stop().unwrap();
        let result = sm.cancel();
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "已经停止，无法取消");
    }

    #[test]
    fn test_state_machine_reset() {
        let mut sm = RecorderStateMachine::new();
        sm.start().unwrap();
        sm.stop().unwrap();
        assert!(sm.reset().is_ok());
        assert_eq!(sm.state(), RecorderState::Idle);
    }

    #[test]
    fn test_state_machine_reset_when_idle_ok() {
        let mut sm = RecorderStateMachine::new();
        // Idle 状态下 reset 直接成功（幂等）
        assert!(sm.reset().is_ok());
        assert_eq!(sm.state(), RecorderState::Idle);
    }

    #[test]
    fn test_state_machine_reset_when_recording_fails() {
        let mut sm = RecorderStateMachine::new();
        sm.start().unwrap();
        let result = sm.reset();
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "录制中无法重置");
    }

    #[test]
    fn test_state_machine_full_cycle() {
        // 完整流程：Idle → Recording → Stopped → Idle → Recording → Idle(cancel)
        let mut sm = RecorderStateMachine::new();
        assert_eq!(sm.state(), RecorderState::Idle);

        sm.start().unwrap();
        assert_eq!(sm.state(), RecorderState::Recording);

        sm.stop().unwrap();
        assert_eq!(sm.state(), RecorderState::Stopped);

        sm.reset().unwrap();
        assert_eq!(sm.state(), RecorderState::Idle);

        // 再次开始 → 取消
        sm.start().unwrap();
        sm.cancel().unwrap();
        assert_eq!(sm.state(), RecorderState::Idle);
    }

    #[test]
    fn test_recorder_mode_serde() {
        let mode = RecorderMode::Region;
        let json = serde_json::to_string(&mode).unwrap();
        assert_eq!(json, "\"Region\"");
        let deserialized: RecorderMode = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized, RecorderMode::Region);
    }

    #[test]
    fn test_recorder_state_serde() {
        let state = RecorderState::Recording;
        let json = serde_json::to_string(&state).unwrap();
        assert_eq!(json, "\"Recording\"");
        let deserialized: RecorderState = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized, RecorderState::Recording);
    }

    #[test]
    fn test_recorder_config_serde() {
        let cfg = RecorderConfig::region(30, CaptureRegion::new(10, 20, 640, 480));
        let json = serde_json::to_string(&cfg).unwrap();
        // 字段 camelCase 序列化（frameIntervalMs 是方法，不出现在 JSON 中）
        assert!(json.contains("\"fps\":30"));
        assert!(json.contains("\"mode\":\"Region\""));
        let deserialized: RecorderConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.fps, 30);
        assert_eq!(deserialized.mode, RecorderMode::Region);
        let region = deserialized.region.unwrap();
        assert_eq!(region.x, 10);
        assert_eq!(region.width, 640);
    }

    // ===== RGBA → I420 转换测试 =====

    #[test]
    fn test_rgba_to_i420_output_sizes() {
        // 4x2 图像：Y=8, U=2, V=2
        let rgba = vec![0u8; 4 * 2 * 4];
        let (y, u, v) = rgba_to_i420(&rgba, 4, 2);
        assert_eq!(y.len(), 8);
        assert_eq!(u.len(), 2);
        assert_eq!(v.len(), 2);
    }

    #[test]
    fn test_rgba_to_i420_red_pixel() {
        // 纯红 RGBA = [255, 0, 0, 255]，2x2
        let px = [255u8, 0, 0, 255];
        let rgba: Vec<u8> = px.repeat(4);
        let (y, u, v) = rgba_to_i420(&rgba, 2, 2);
        // Y(红) ≈ 76
        assert!((y[0] as i32 - 76).abs() <= 2);
        // U(红) 偏低
        assert!(u[0] < 128);
        // V(红) 偏高
        assert!(v[0] > 128);
    }

    #[test]
    fn test_rgba_to_i420_green_pixel() {
        // 纯绿 RGBA = [0, 255, 0, 255]
        let px = [0u8, 255, 0, 255];
        let rgba: Vec<u8> = px.repeat(4);
        let (y, _u, _v) = rgba_to_i420(&rgba, 2, 2);
        // Y(绿) ≈ 149
        assert!((y[0] as i32 - 149).abs() <= 2);
    }

    #[test]
    fn test_rgba_to_i420_blue_pixel() {
        // 纯蓝 RGBA = [0, 0, 255, 255]
        let px = [0u8, 0, 255, 255];
        let rgba: Vec<u8> = px.repeat(4);
        let (y, u, v) = rgba_to_i420(&rgba, 2, 2);
        // Y(蓝) ≈ 29
        assert!((y[0] as i32 - 29).abs() <= 2);
        // U(蓝) 偏高
        assert!(u[0] > 128);
        // V(蓝) 偏低
        assert!(v[0] < 128);
    }

    #[test]
    fn test_rgba_to_i420_white_pixel() {
        // 白色 RGBA = [255, 255, 255, 255]
        let px = [255u8, 255, 255, 255];
        let rgba: Vec<u8> = px.repeat(4);
        let (y, u, v) = rgba_to_i420(&rgba, 2, 2);
        assert_eq!(y[0], 255);
        assert_eq!(u[0], 128);
        assert_eq!(v[0], 128);
    }

    #[test]
    fn test_rgba_to_i420_black_pixel() {
        // 黑色 RGBA = [0, 0, 0, 255]
        let px = [0u8, 0, 0, 255];
        let rgba: Vec<u8> = px.repeat(4);
        let (y, u, v) = rgba_to_i420(&rgba, 2, 2);
        assert_eq!(y[0], 0);
        assert_eq!(u[0], 128);
        assert_eq!(v[0], 128);
    }

    #[test]
    fn test_rgba_to_i420_alpha_ignored() {
        // 相同 RGB、不同 A，结果应一致
        let rgba1: Vec<u8> = [255u8, 0, 0, 0].repeat(4);
        let rgba2: Vec<u8> = [255u8, 0, 0, 255].repeat(4);
        let (y1, u1, v1) = rgba_to_i420(&rgba1, 2, 2);
        let (y2, u2, v2) = rgba_to_i420(&rgba2, 2, 2);
        assert_eq!(y1, y2);
        assert_eq!(u1, u2);
        assert_eq!(v1, v2);
    }

    #[test]
    fn test_i420_to_contiguous_length() {
        let y = vec![1u8; 8];
        let u = vec![2u8; 2];
        let v = vec![3u8; 2];
        let buf = i420_to_contiguous(&y, &u, &v);
        assert_eq!(buf.len(), 12);
        // Y 在前
        assert_eq!(buf[0], 1);
        // U 在中
        assert_eq!(buf[8], 2);
        // V 在后
        assert_eq!(buf[10], 3);
    }

    // ===== OutputFormat 测试 =====

    #[test]
    fn test_output_format_default_is_mp4() {
        assert_eq!(OutputFormat::default(), OutputFormat::Mp4);
    }

    #[test]
    fn test_output_format_serde() {
        let json = serde_json::to_string(&OutputFormat::Gif).unwrap();
        assert_eq!(json, "\"Gif\"");
        let de: OutputFormat = serde_json::from_str(&json).unwrap();
        assert_eq!(de, OutputFormat::Gif);
    }

    #[test]
    fn test_config_default_format_mp4_no_audio() {
        let cfg = RecorderConfig::default();
        assert_eq!(cfg.output_format, OutputFormat::Mp4);
        assert!(!cfg.audio_enabled);
        assert!(!cfg.effective_audio());
    }

    #[test]
    fn test_effective_audio_only_when_mp4_and_enabled() {
        // MP4 + 音频 → true
        let cfg = RecorderConfig {
            fps: 30,
            mode: RecorderMode::Fullscreen,
            region: None,
            output_format: OutputFormat::Mp4,
            audio_enabled: true,
        };
        assert!(cfg.effective_audio());

        // GIF + 音频 → false（GIF 无音频）
        let cfg = RecorderConfig {
            fps: 30,
            mode: RecorderMode::Fullscreen,
            region: None,
            output_format: OutputFormat::Gif,
            audio_enabled: true,
        };
        assert!(!cfg.effective_audio());

        // MP4 + 无音频 → false
        let cfg = RecorderConfig::fullscreen(30);
        assert!(!cfg.effective_audio());
    }

    #[test]
    fn test_extension_for_format() {
        assert_eq!(
            RecorderConfig {
                fps: 30,
                mode: RecorderMode::Fullscreen,
                region: None,
                output_format: OutputFormat::Mp4,
                audio_enabled: false,
            }
            .extension(),
            "mp4"
        );
        assert_eq!(
            RecorderConfig {
                fps: 30,
                mode: RecorderMode::Fullscreen,
                region: None,
                output_format: OutputFormat::Gif,
                audio_enabled: false,
            }
            .extension(),
            "gif"
        );
    }

    #[test]
    fn test_config_serde_backward_compat() {
        // 旧版本前端请求不带 outputFormat/audioEnabled 字段，应回退默认值
        let json = r#"{"fps":30,"mode":"Fullscreen","region":null}"#;
        let cfg: RecorderConfig = serde_json::from_str(json).unwrap();
        assert_eq!(cfg.fps, 30);
        assert_eq!(cfg.output_format, OutputFormat::Mp4);
        assert!(!cfg.audio_enabled);
    }

    #[test]
    fn test_config_serde_with_new_fields() {
        let json = r#"{"fps":15,"mode":"Region","region":{"x":0,"y":0,"width":100,"height":100},"outputFormat":"Gif","audioEnabled":false}"#;
        let cfg: RecorderConfig = serde_json::from_str(json).unwrap();
        assert_eq!(cfg.fps, 15);
        assert_eq!(cfg.output_format, OutputFormat::Gif);
        assert!(!cfg.audio_enabled);
        assert!(!cfg.effective_audio());
    }
}
