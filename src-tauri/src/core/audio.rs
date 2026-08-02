use serde::{Deserialize, Serialize};

/// 音频通道数
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AudioChannels {
    Mono,
    Stereo,
}

impl AudioChannels {
    /// 转为 opus crate 的 Channels
    pub fn to_opus(&self) -> opus::Channels {
        match self {
            Self::Mono => opus::Channels::Mono,
            Self::Stereo => opus::Channels::Stereo,
        }
    }

    /// 通道数
    pub fn count(&self) -> u16 {
        match self {
            Self::Mono => 1,
            Self::Stereo => 2,
        }
    }
}

/// 音频配置
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioConfig {
    /// 采样率（Hz），Opus 标准：8000/12000/16000/24000/48000
    pub sample_rate: u32,
    /// 通道数
    pub channels: AudioChannels,
}

impl Default for AudioConfig {
    fn default() -> Self {
        Self {
            sample_rate: 48_000,
            channels: AudioChannels::Stereo,
        }
    }
}

impl AudioConfig {
    /// 每帧采样数（Opus 20ms 帧 = sample_rate / 50）
    pub fn samples_per_frame(&self) -> usize {
        (self.sample_rate as usize) / 50
    }

    /// 每帧字节数（i16 = 2 字节/样本 × 通道数）
    pub fn frame_bytes(&self) -> usize {
        self.samples_per_frame() * self.channels.count() as usize * 2
    }

    /// 帧时长（秒）
    pub fn frame_duration(&self) -> f64 {
        0.02
    }

    /// 是否合法
    pub fn is_valid(&self) -> bool {
        matches!(self.sample_rate, 8000 | 12000 | 16000 | 24000 | 48000)
            && self.channels.count() > 0
    }
}

/// Opus 编码器封装
pub struct OpusEncoder {
    encoder: opus::Encoder,
    config: AudioConfig,
}

impl OpusEncoder {
    /// 创建编码器
    pub fn new(config: AudioConfig) -> Result<Self, String> {
        if !config.is_valid() {
            return Err(format!("音频配置无效: {:?}", config));
        }
        let encoder = opus::Encoder::new(
            config.sample_rate,
            config.channels.to_opus(),
            opus::Application::Audio,
        )
        .map_err(|e| format!("创建 Opus 编码器失败: {}", e))?;
        Ok(Self { encoder, config })
    }

    /// 编码一帧 PCM i16 → Opus 包
    /// - pcm: 交错排列的 i16 样本（样本数 = samples_per_frame × channels）
    /// - 返回编码后的 Opus 字节
    pub fn encode(&mut self, pcm: &[i16]) -> Result<Vec<u8>, String> {
        let expected = self.config.samples_per_frame() * self.config.channels.count() as usize;
        if pcm.len() < expected {
            return Err(format!(
                "PCM 样本不足: {} < {}",
                pcm.len(),
                expected
            ));
        }
        let mut out = vec![0u8; 4000];
        let len = self
            .encoder
            .encode(&pcm[..expected], &mut out)
            .map_err(|e| format!("Opus 编码失败: {}", e))?;
        out.truncate(len);
        Ok(out)
    }

    /// 当前配置
    pub fn config(&self) -> AudioConfig {
        self.config
    }
}

/// 将 f32 浮点样本（[-1.0, 1.0]）转为 i16 PCM
pub fn f32_to_i16(samples: &[f32]) -> Vec<i16> {
    samples
        .iter()
        .map(|&s| {
            let clamped = s.clamp(-1.0, 1.0);
            (clamped * 32767.0) as i16
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_audio_config_default() {
        let cfg = AudioConfig::default();
        assert_eq!(cfg.sample_rate, 48_000);
        assert_eq!(cfg.channels, AudioChannels::Stereo);
        assert!(cfg.is_valid());
    }

    #[test]
    fn test_channels_count() {
        assert_eq!(AudioChannels::Mono.count(), 1);
        assert_eq!(AudioChannels::Stereo.count(), 2);
    }

    #[test]
    fn test_samples_per_frame() {
        let cfg = AudioConfig::default();
        // 48000 / 50 = 960
        assert_eq!(cfg.samples_per_frame(), 960);
    }

    #[test]
    fn test_frame_bytes_stereo() {
        let cfg = AudioConfig::default();
        // 960 * 2 通道 * 2 字节 = 3840
        assert_eq!(cfg.frame_bytes(), 3840);
    }

    #[test]
    fn test_frame_bytes_mono() {
        let cfg = AudioConfig {
            sample_rate: 48_000,
            channels: AudioChannels::Mono,
        };
        // 960 * 1 * 2 = 1920
        assert_eq!(cfg.frame_bytes(), 1920);
    }

    #[test]
    fn test_frame_duration() {
        assert_eq!(AudioConfig::default().frame_duration(), 0.02);
    }

    #[test]
    fn test_invalid_sample_rate() {
        let cfg = AudioConfig {
            sample_rate: 44_100,
            channels: AudioChannels::Stereo,
        };
        // 44100 不在 Opus 支持列表
        assert!(!cfg.is_valid());
    }

    #[test]
    fn test_valid_sample_rates() {
        for &sr in &[8000, 12000, 16000, 24000, 48000] {
            let cfg = AudioConfig {
                sample_rate: sr,
                channels: AudioChannels::Mono,
            };
            assert!(cfg.is_valid(), "采样率 {} 应合法", sr);
        }
    }

    #[test]
    fn test_audio_config_serde() {
        let cfg = AudioConfig::default();
        let json = serde_json::to_string(&cfg).unwrap();
        assert!(json.contains("\"sampleRate\":48000"));
        assert!(json.contains("\"channels\":\"Stereo\""));
        let de: AudioConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(de.sample_rate, 48_000);
    }

    #[test]
    fn test_audio_channels_serde() {
        let json = serde_json::to_string(&AudioChannels::Mono).unwrap();
        assert_eq!(json, "\"Mono\"");
        let json = serde_json::to_string(&AudioChannels::Stereo).unwrap();
        assert_eq!(json, "\"Stereo\"");
    }

    #[test]
    fn test_opus_encoder_create_and_encode() {
        let cfg = AudioConfig::default();
        let mut enc = OpusEncoder::new(cfg).unwrap();
        // 960 样本 × 2 通道 = 1920 个 i16，静音数据
        let pcm = vec![0i16; 1920];
        let packet = enc.encode(&pcm).unwrap();
        // Opus 静音帧应该有输出且非空
        assert!(!packet.is_empty());
        assert!(packet.len() <= 4000);
    }

    #[test]
    fn test_opus_encoder_rejects_invalid_config() {
        let cfg = AudioConfig {
            sample_rate: 44_100,
            channels: AudioChannels::Stereo,
        };
        assert!(OpusEncoder::new(cfg).is_err());
    }

    #[test]
    fn test_opus_encoder_rejects_short_pcm() {
        let cfg = AudioConfig::default();
        let mut enc = OpusEncoder::new(cfg).unwrap();
        // 样本不足
        let pcm = vec![0i16; 100];
        assert!(enc.encode(&pcm).is_err());
    }

    #[test]
    fn test_f32_to_i16_silence() {
        let samples = vec![0.0; 10];
        let pcm = f32_to_i16(&samples);
        assert!(pcm.iter().all(|&x| x == 0));
    }

    #[test]
    fn test_f32_to_i16_max() {
        let samples = vec![1.0; 4];
        let pcm = f32_to_i16(&samples);
        assert!(pcm.iter().all(|&x| x == 32767));
    }

    #[test]
    fn test_f32_to_i16_clamp() {
        // 超出范围应被 clamp
        let samples = vec![2.0, -2.0, 0.5];
        let pcm = f32_to_i16(&samples);
        assert_eq!(pcm[0], 32767);
        assert_eq!(pcm[1], -32767);
        // 0.5 * 32767 = 16383.5 → 16383
        assert!(pcm[2] >= 16382 && pcm[2] <= 16384);
    }
}
