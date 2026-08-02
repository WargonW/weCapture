use std::fs::File;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

use image::RgbaImage;
use muxide::api::{MuxerBuilder, VideoCodec};
use openh264::encoder::Encoder;
use openh264::formats::YUVBuffer;
use xcap::Monitor;

use crate::core::recorder::{
    i420_to_contiguous, rgba_to_i420, RecorderConfig, RecorderMode, RecorderState,
};

/// 录屏会话：持有配置 + 状态机（纯逻辑，不涉及线程）
#[derive(Debug)]
pub struct RecorderSession {
    config: RecorderConfig,
    state_machine: crate::core::recorder::RecorderStateMachine,
}

impl RecorderSession {
    pub fn new(config: RecorderConfig) -> Self {
        Self {
            config,
            state_machine: crate::core::recorder::RecorderStateMachine::new(),
        }
    }

    pub fn config(&self) -> &RecorderConfig {
        &self.config
    }

    pub fn state(&self) -> RecorderState {
        self.state_machine.state()
    }

    pub fn start(&mut self) -> Result<(), String> {
        if !self.config.is_valid() {
            return Err("录屏配置无效".to_string());
        }
        self.state_machine.start()
    }

    pub fn stop(&mut self) -> Result<(), String> {
        self.state_machine.stop()
    }

    pub fn cancel(&mut self) -> Result<(), String> {
        self.state_machine.cancel()
    }

    pub fn reset(&mut self) -> Result<(), String> {
        self.state_machine.reset()
    }
}

/// 活跃录制：持有后台线程句柄
struct ActiveRecording {
    config: RecorderConfig,
    output_path: String,
    stop_flag: Arc<AtomicBool>,
    handle: JoinHandle<Result<(), String>>,
    error: Arc<Mutex<Option<String>>>,
}

/// 全局录屏服务：持有单个活跃会话
pub struct RecorderService {
    active: Mutex<Option<ActiveRecording>>,
    state: Mutex<RecorderState>,
}

impl RecorderService {
    pub fn new() -> Self {
        Self {
            active: Mutex::new(None),
            state: Mutex::new(RecorderState::Idle),
        }
    }

    /// 启动新会话
    /// - config: 录屏配置
    /// - output_dir: 输出目录（MP4 文件保存于此）
    pub fn start(&self, config: RecorderConfig, output_dir: &PathBuf) -> Result<(), String> {
        if !config.is_valid() {
            return Err(format!(
                "录屏配置无效: fps={}, mode={:?}",
                config.fps, config.mode
            ));
        }

        let mut guard = self.active.lock().map_err(|e| format!("锁失败: {}", e))?;
        if let Some(a) = guard.as_ref() {
            if !a.handle.is_finished() {
                return Err("已有录屏进行中".to_string());
            }
        }

        let output_path = generate_output_path(output_dir, config.extension());
        let stop_flag = Arc::new(AtomicBool::new(false));
        let error = Arc::new(Mutex::new(None));
        let cfg = config.clone();
        let path = output_path.clone();
        let flag = stop_flag.clone();
        let err = error.clone();

        let handle = thread::Builder::new()
            .name("recorder".to_string())
            .spawn(move || run_recording(cfg, flag, err, path))
            .map_err(|e| format!("启动录屏线程失败: {}", e))?;

        *guard = Some(ActiveRecording {
            config,
            output_path,
            stop_flag,
            handle,
            error,
        });
        *self.state.lock().map_err(|e| format!("锁失败: {}", e))? = RecorderState::Recording;
        Ok(())
    }

    /// 停止录制，返回 MP4 文件路径
    pub fn stop(&self) -> Result<String, String> {
        let mut guard = self.active.lock().map_err(|e| format!("锁失败: {}", e))?;
        let active = guard.take().ok_or("没有活跃的录屏会话")?;
        active.stop_flag.store(true, Ordering::SeqCst);
        let join_result = active.handle.join();
        *self.state.lock().map_err(|e| format!("锁失败: {}", e))? = RecorderState::Stopped;

        // 优先返回线程错误
        if let Err(e) = join_result {
            return Err(format!("录屏线程异常: {:?}", e));
        }
        if let Ok(Err(e)) = join_result {
            return Err(e);
        }
        // 检查运行期错误槽
        if let Some(e) = active.error.lock().ok().and_then(|m| m.clone()) {
            return Err(e);
        }
        Ok(active.output_path)
    }

    /// 取消录制（不产生结果）
    pub fn cancel(&self) -> Result<(), String> {
        let mut guard = self.active.lock().map_err(|e| format!("锁失败: {}", e))?;
        if let Some(active) = guard.take() {
            active.stop_flag.store(true, Ordering::SeqCst);
            let _ = active.handle.join();
        }
        *self.state.lock().map_err(|e| format!("锁失败: {}", e))? = RecorderState::Idle;
        Ok(())
    }

    /// 查询当前状态
    pub fn state(&self) -> Result<RecorderState, String> {
        Ok(*self
            .state
            .lock()
            .map_err(|e| format!("锁失败: {}", e))?)
    }

    /// 重置到 Idle
    pub fn reset(&self) -> Result<(), String> {
        let mut guard = self.active.lock().map_err(|e| format!("锁失败: {}", e))?;
        if let Some(active) = guard.take() {
            if !active.handle.is_finished() {
                active.stop_flag.store(true, Ordering::SeqCst);
                let _ = active.handle.join();
            }
        }
        *self.state.lock().map_err(|e| format!("锁失败: {}", e))? = RecorderState::Idle;
        Ok(())
    }

    /// 获取当前配置快照
    pub fn config(&self) -> Result<Option<RecorderConfig>, String> {
        let guard = self.active.lock().map_err(|e| format!("锁失败: {}", e))?;
        Ok(guard.as_ref().map(|a| a.config.clone()))
    }
}

impl Default for RecorderService {
    fn default() -> Self {
        Self::new()
    }
}

/// 生成输出文件路径：{output_dir}/snapmaster_record_{timestamp}.{ext}
fn generate_output_path(output_dir: &PathBuf, ext: &str) -> String {
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    output_dir
        .join(format!("snapmaster_record_{}.{}", ts, ext))
        .to_string_lossy()
        .to_string()
}

/// 后台录制线程主逻辑：按输出格式分发
fn run_recording(
    config: RecorderConfig,
    stop_flag: Arc<AtomicBool>,
    error_slot: Arc<Mutex<Option<String>>>,
    output_path: String,
) -> Result<(), String> {
    match config.output_format {
        crate::core::recorder::OutputFormat::Mp4 => {
            run_mp4_recording(config, stop_flag, error_slot, output_path)
        }
        crate::core::recorder::OutputFormat::Gif => {
            run_gif_recording(config, stop_flag, error_slot, output_path)
        }
    }
}

/// MP4 录制路径：xcap 采集 → H.264 编码 → muxide 封装（可选 Opus 音频）
fn run_mp4_recording(
    config: RecorderConfig,
    stop_flag: Arc<AtomicBool>,
    error_slot: Arc<Mutex<Option<String>>>,
    output_path: String,
) -> Result<(), String> {
    let monitor = primary_monitor()?;

    // 首帧采集确定尺寸
    let first = capture_frame(&monitor, &config)?;
    let (_rgba_raw, w, h) = frame_to_even_rgba(&first);

    let mut encoder = Encoder::new().map_err(|e| format!("创建编码器失败: {}", e))?;
    let file = File::create(&output_path).map_err(|e| format!("创建文件失败: {}", e))?;

    // 根据是否录制音频配置 muxer
    let audio_cfg = if config.effective_audio() {
        Some(crate::core::audio::AudioConfig::default())
    } else {
        None
    };

    let mut muxer = {
        let mut builder = MuxerBuilder::new(file)
            .video(VideoCodec::H264, w as u32, h as u32, config.fps as f64);
        if let Some(ac) = audio_cfg {
            builder = builder.audio(
                muxide::api::AudioCodec::Opus,
                ac.sample_rate,
                ac.channels.count(),
            );
        }
        builder
            .build()
            .map_err(|e| format!("创建 muxer 失败: {}", e))?
    };

    // 启动音频采集线程（仅当启用音频且编译了 audio feature）
    #[cfg(feature = "audio")]
    let audio_rx = if let Some(ac) = audio_cfg {
        Some(spawn_audio_capture(ac, stop_flag.clone()))
    } else {
        None
    };
    #[cfg(not(feature = "audio"))]
    let _ = audio_cfg; // 抑制未使用警告

    let interval = Duration::from_millis(config.frame_interval_ms().max(10));
    let step = 1.0 / config.fps as f64;
    let mut pts: f64 = 0.0;
    let mut frame_idx: u32 = 0;
    #[cfg(feature = "audio")]
    let mut audio_count: u32 = 0;
    let loop_start = Instant::now();

    loop {
        if stop_flag.load(Ordering::SeqCst) {
            break;
        }
        // 超过 1 小时自动停止（保护）
        if loop_start.elapsed() > Duration::from_secs(3600) {
            break;
        }

        let frame = match capture_frame(&monitor, &config) {
            Ok(f) => f,
            Err(e) => {
                set_error(&error_slot, &e);
                return Err(e);
            }
        };
        let (rgba, fw, fh) = frame_to_even_rgba(&frame);

        // 尺寸变化（理论上不会，但防御性处理）
        if fw != w || fh != h {
            let e = format!("帧尺寸变化: ({},{}) != ({},{})", fw, fh, w, h);
            set_error(&error_slot, &e);
            return Err(e);
        }

        let (y, u, v) = rgba_to_i420(&rgba, fw, fh);
        let yuv_buf = i420_to_contiguous(&y, &u, &v);
        let yuv = YUVBuffer::from_vec(yuv_buf, fw, fh);

        let bitstream = encoder
            .encode(&yuv)
            .map_err(|e| format!("编码失败: {}", e))?;
        let mut bytes = Vec::new();
        bitstream
            .write(&mut bytes)
            .map_err(|e| format!("写入码流失败: {}", e))?;

        let is_key = frame_idx == 0;
        muxer
            .write_video(pts, &bytes, is_key)
            .map_err(|e| format!("写入 muxer 失败: {}", e))?;

        // 写入已就绪的音频包（非阻塞）
        #[cfg(feature = "audio")]
        if let Some(rx) = audio_rx.as_ref() {
            while let Ok(opus_packet) = rx.try_recv() {
                // 音频 PTS 用包计数 × 帧时长（20ms），需 >= 第一帧视频 PTS(0)
                let audio_pts = 0.02 * audio_count as f64;
                if let Err(e) = muxer.write_audio(audio_pts, &opus_packet) {
                    // 音频写入失败不阻断视频，仅记录
                    log::warn!("写入音频帧失败: {}", e);
                    break;
                }
                audio_count += 1;
            }
        }

        pts += step;
        frame_idx += 1;
        sleep_with_flag(&stop_flag, interval);
    }

    // 录制结束前，排空剩余音频包
    #[cfg(feature = "audio")]
    if let Some(rx) = audio_rx.as_ref() {
        while let Ok(opus_packet) = rx.try_recv() {
            let audio_pts = 0.02 * audio_count as f64;
            if muxer.write_audio(audio_pts, &opus_packet).is_err() {
                break;
            }
            audio_count += 1;
        }
    }

    muxer.finish().map_err(|e| format!("结束 muxer 失败: {}", e))?;
    Ok(())
}

/// GIF 录制路径：xcap 采集 → 降采样 → gif::Encoder 逐帧写入
fn run_gif_recording(
    config: RecorderConfig,
    stop_flag: Arc<AtomicBool>,
    error_slot: Arc<Mutex<Option<String>>>,
    output_path: String,
) -> Result<(), String> {
    use crate::core::gif::{downsample_rgba, GifEncoder};

    let monitor = primary_monitor()?;

    // 首帧采集确定尺寸并降采样
    let first = capture_frame(&monitor, &config)?;
    let (first_rgba, src_w, src_h) = frame_to_even_rgba(&first);
    let max_w: u32 = 480; // GIF 限制最大宽度，控制文件大小
    let (_, gif_w, gif_h) = downsample_rgba(&first_rgba, src_w as u32, src_h as u32, max_w)?;

    let mut gif = GifEncoder::from_path(&output_path, gif_w, gif_h)
        .map_err(|e| format!("创建 GIF 编码器失败: {}", e))?;

    let interval = Duration::from_millis(config.frame_interval_ms().max(10));
    // GIF delay 精度 1/100s，帧间隔转毫秒
    let delay_ms = (1000 / config.fps.max(1)) as u32;
    let mut frame_idx: u32 = 0;
    let loop_start = Instant::now();

    loop {
        if stop_flag.load(Ordering::SeqCst) {
            break;
        }
        if loop_start.elapsed() > Duration::from_secs(600) {
            // GIF 录制限制 10 分钟（文件大小保护）
            break;
        }

        let frame = match capture_frame(&monitor, &config) {
            Ok(f) => f,
            Err(e) => {
                set_error(&error_slot, &e);
                return Err(e);
            }
        };
        let (rgba, fw, fh) = frame_to_even_rgba(&frame);

        if fw != src_w || fh != src_h {
            let e = format!("帧尺寸变化: ({},{}) != ({},{})", fw, fh, src_w, src_h);
            set_error(&error_slot, &e);
            return Err(e);
        }

        let (down_rgba, _, _) = downsample_rgba(&rgba, fw as u32, fh as u32, max_w)?;
        gif.write_frame(down_rgba, delay_ms)
            .map_err(|e| format!("写入 GIF 失败: {}", e))?;

        frame_idx += 1;
        sleep_with_flag(&stop_flag, interval);
    }

    // GIF 编码器 drop 时自动写入结尾
    log::info!("GIF 录制完成: {} 帧", frame_idx);
    Ok(())
}

/// 启动系统音频采集线程（PulseAudio/ALSA monitor source）
/// 返回 Opus 包接收端。线程在 stop_flag 置位或主线程断开时退出。
/// 沙箱/无设备环境下线程会优雅退出，主线程不会收到音频包。
#[cfg(feature = "audio")]
fn spawn_audio_capture(
    config: crate::core::audio::AudioConfig,
    stop_flag: Arc<AtomicBool>,
) -> std::sync::mpsc::Receiver<Vec<u8>> {
    use crate::core::audio::{f32_to_i16, OpusEncoder};
    use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
    use std::sync::mpsc;

    let (opus_tx, opus_rx) = mpsc::channel();
    let (pcm_tx, pcm_rx) = mpsc::channel::<Vec<f32>>();
    let flag = stop_flag.clone();

    std::thread::spawn(move || {
        // 1. 选择音频输入设备（默认输入；真实环境可扩展为枚举 monitor source）
        let host = cpal::default_host();
        let device = match host.default_input_device() {
            Some(d) => d,
            None => {
                log::warn!("未找到音频输入设备，跳过音频录制");
                return;
            }
        };

        // 2. 获取设备支持的配置
        let supported = match device.default_input_config() {
            Ok(s) => s,
            Err(e) => {
                log::warn!("获取音频配置失败: {}", e);
                return;
            }
        };

        // 强制使用 Opus 要求的采样率
        let mut stream_config: cpal::StreamConfig = supported.into();
        stream_config.sample_rate = config.sample_rate.into();
        let channels = config.channels.count();

        // 3. 创建 Opus 编码器
        let mut encoder = match OpusEncoder::new(config) {
            Ok(e) => e,
            Err(e) => {
                log::warn!("创建 Opus 编码器失败: {}", e);
                return;
            }
        };

        let samples_per_frame = config.samples_per_frame();
        let frame_samples = samples_per_frame * channels as usize;
        let mut pcm_buffer: Vec<f32> = Vec::with_capacity(frame_samples);

        // 4. 建立输入流
        let tx = pcm_tx.clone();
        let stream = device.build_input_stream(
            &stream_config,
            move |data: &[f32], _: &cpal::InputCallbackInfo| {
                let _ = tx.send(data.to_vec());
            },
            |err| log::warn!("音频流错误: {}", err),
            None,
        );
        let stream = match stream {
            Ok(s) => s,
            Err(e) => {
                log::warn!("建立音频流失败: {}", e);
                return;
            }
        };
        if let Err(e) = stream.play() {
            log::warn!("启动音频流失败: {}", e);
            return;
        }

        // 5. 编码循环：累积 PCM → 满一帧 → Opus 编码 → 发送
        while !flag.load(Ordering::SeqCst) {
            match pcm_rx.recv_timeout(Duration::from_millis(50)) {
                Ok(chunk) => {
                    pcm_buffer.extend_from_slice(&chunk);
                    while pcm_buffer.len() >= frame_samples {
                        let frame: Vec<f32> = pcm_buffer.drain(..frame_samples).collect();
                        let pcm_i16 = f32_to_i16(&frame);
                        match encoder.encode(&pcm_i16) {
                            Ok(packet) => {
                                if opus_tx.send(packet).is_err() {
                                    // 主线程已结束
                                    return;
                                }
                            }
                            Err(e) => log::warn!("Opus 编码失败: {}", e),
                        }
                    }
                }
                Err(mpsc::RecvTimeoutError::Timeout) => continue,
                Err(mpsc::RecvTimeoutError::Disconnected) => break,
            }
        }
        drop(stream);
    });

    opus_rx
}

/// 获取主显示器
fn primary_monitor() -> Result<Monitor, String> {
    let monitors = Monitor::all().map_err(|e| format!("获取显示器列表失败: {}", e))?;
    monitors
        .into_iter()
        .find(|m| m.is_primary().unwrap_or(false))
        .or_else(|| Monitor::all().ok()?.into_iter().next())
        .ok_or("没有可用的显示器".to_string())
}

/// 按模式采集一帧
fn capture_frame(monitor: &Monitor, config: &RecorderConfig) -> Result<RgbaImage, String> {
    match config.mode {
        RecorderMode::Fullscreen => monitor
            .capture_image()
            .map_err(|e| format!("采集全屏失败: {}", e)),
        RecorderMode::Region => {
            let r = config.region.ok_or("选区模式缺少 region")?;
            if r.x < 0 || r.y < 0 {
                return Err("选区坐标不能为负数".to_string());
            }
            monitor
                .capture_region(r.x as u32, r.y as u32, r.width, r.height)
                .map_err(|e| format!("采集选区失败: {}", e))
        }
    }
}

/// 将帧转为偶数宽高的紧凑 RGBA（YUV420 要求偶数尺寸）
fn frame_to_even_rgba(img: &RgbaImage) -> (Vec<u8>, usize, usize) {
    let w = img.width() as usize;
    let h = img.height() as usize;
    let we = w - (w % 2);
    let he = h - (h % 2);
    if we == w && he == h {
        return (img.as_raw().clone(), w, h);
    }
    let raw = img.as_raw();
    let mut out = Vec::with_capacity(we * he * 4);
    for j in 0..he {
        let start = j * w * 4;
        out.extend_from_slice(&raw[start..start + we * 4]);
    }
    (out, we, he)
}

/// 分段 sleep，每 10ms 检查停止标志
fn sleep_with_flag(stop_flag: &AtomicBool, total: Duration) {
    let mut remaining = total;
    let step = Duration::from_millis(10);
    while remaining > Duration::ZERO {
        if stop_flag.load(Ordering::SeqCst) {
            return;
        }
        let s = remaining.min(step);
        thread::sleep(s);
        remaining = remaining.saturating_sub(s);
    }
}

/// 写入错误槽
fn set_error(slot: &Mutex<Option<String>>, msg: &str) {
    if let Ok(mut g) = slot.lock() {
        if g.is_none() {
            *g = Some(msg.to_string());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::screenshot::CaptureRegion;

    #[test]
    fn test_session_new() {
        let session = RecorderSession::new(RecorderConfig::fullscreen(30));
        assert_eq!(session.state(), RecorderState::Idle);
        assert_eq!(session.config().fps, 30);
    }

    #[test]
    fn test_session_start_stop() {
        let mut session = RecorderSession::new(RecorderConfig::fullscreen(30));
        assert!(session.start().is_ok());
        assert_eq!(session.state(), RecorderState::Recording);
        assert!(session.stop().is_ok());
        assert_eq!(session.state(), RecorderState::Stopped);
    }

    #[test]
    fn test_session_invalid_config_rejects_start() {
        let mut session = RecorderSession::new(RecorderConfig::fullscreen(0));
        let result = session.start();
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "录屏配置无效");
        assert_eq!(session.state(), RecorderState::Idle);
    }

    #[test]
    fn test_service_new_is_idle() {
        let service = RecorderService::new();
        assert_eq!(service.state().unwrap(), RecorderState::Idle);
    }

    #[test]
    fn test_service_stop_when_idle_fails() {
        let service = RecorderService::new();
        let result = service.stop();
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "没有活跃的录屏会话");
    }

    #[test]
    fn test_service_cancel_when_idle_ok() {
        let service = RecorderService::new();
        assert!(service.cancel().is_ok());
        assert_eq!(service.state().unwrap(), RecorderState::Idle);
    }

    #[test]
    fn test_service_reset_when_idle_ok() {
        let service = RecorderService::new();
        assert!(service.reset().is_ok());
        assert_eq!(service.state().unwrap(), RecorderState::Idle);
    }

    #[test]
    fn test_service_rejects_invalid_config() {
        let service = RecorderService::new();
        let dir = PathBuf::from("/tmp");
        let result = service.start(RecorderConfig::fullscreen(0), &dir);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("录屏配置无效"));
        assert_eq!(service.state().unwrap(), RecorderState::Idle);
    }

    #[test]
    fn test_service_config_when_idle_is_none() {
        let service = RecorderService::new();
        assert!(service.config().unwrap().is_none());
    }

    #[test]
    fn test_generate_output_path_format() {
        let dir = PathBuf::from("/tmp");
        let path = generate_output_path(&dir, "mp4");
        assert!(path.starts_with("/tmp/snapmaster_record_"));
        assert!(path.ends_with(".mp4"));
        let gif_path = generate_output_path(&dir, "gif");
        assert!(gif_path.ends_with(".gif"));
    }

    #[test]
    fn test_frame_to_even_rgba_already_even() {
        // 4x2 偶数尺寸，直接克隆
        let img: RgbaImage = RgbaImage::from_raw(4, 2, vec![0u8; 4 * 2 * 4]).unwrap();
        let (rgba, w, h) = frame_to_even_rgba(&img);
        assert_eq!(w, 4);
        assert_eq!(h, 2);
        assert_eq!(rgba.len(), 4 * 2 * 4);
    }

    #[test]
    fn test_frame_to_even_rgba_odd_width() {
        // 5x3 → 4x2
        let img: RgbaImage = RgbaImage::from_raw(5, 3, vec![0u8; 5 * 3 * 4]).unwrap();
        let (rgba, w, h) = frame_to_even_rgba(&img);
        assert_eq!(w, 4);
        assert_eq!(h, 2);
        assert_eq!(rgba.len(), 4 * 2 * 4);
    }

    #[test]
    fn test_sleep_with_flag_returns_on_stop() {
        let flag = Arc::new(AtomicBool::new(false));
        let start = Instant::now();
        sleep_with_flag(&flag, Duration::from_millis(30));
        // 应 sleep 约 30ms
        assert!(start.elapsed() >= Duration::from_millis(20));
    }

    #[test]
    fn test_sleep_with_flag_interrupts() {
        let flag = Arc::new(AtomicBool::new(false));
        let flag2 = flag.clone();
        // 50ms 后设置停止
        thread::spawn(move || {
            thread::sleep(Duration::from_millis(20));
            flag2.store(true, Ordering::SeqCst);
        });
        let start = Instant::now();
        sleep_with_flag(&flag, Duration::from_millis(500));
        // 应在 ~30ms 内返回，远小于 500ms
        assert!(start.elapsed() < Duration::from_millis(200));
    }
}
