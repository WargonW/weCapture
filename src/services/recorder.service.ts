import { invoke } from '@tauri-apps/api/core'
import type { CaptureRegion } from '../types/capture'

/// 录屏模式（与 Rust 端 RecorderMode 一致）
export type RecorderMode = 'Fullscreen' | 'Region'

/// 录屏状态（与 Rust 端 RecorderState 一致）
export type RecorderState = 'Idle' | 'Recording' | 'Stopped'

/// 输出格式（与 Rust 端 OutputFormat 一致）
export type OutputFormat = 'Mp4' | 'Gif'

/// 录屏配置（与 Rust 端 RecorderConfig 一致，camelCase）
export interface RecorderConfig {
  fps: number
  mode: RecorderMode
  region: CaptureRegion | null
  /// 输出格式（默认 Mp4）
  outputFormat?: OutputFormat
  /// 是否录制音频（仅 Mp4 有效，默认 false）
  audioEnabled?: boolean
}

/// 默认帧率
export const DEFAULT_FPS = 30

/// 创建全屏录屏配置
export function fullscreenConfig(
  fps: number = DEFAULT_FPS,
  opts: { outputFormat?: OutputFormat; audioEnabled?: boolean } = {},
): RecorderConfig {
  return {
    fps,
    mode: 'Fullscreen',
    region: null,
    outputFormat: opts.outputFormat ?? 'Mp4',
    audioEnabled: opts.audioEnabled ?? false,
  }
}

/// 创建选区录屏配置
export function regionConfig(
  region: CaptureRegion,
  fps: number = DEFAULT_FPS,
  opts: { outputFormat?: OutputFormat; audioEnabled?: boolean } = {},
): RecorderConfig {
  return {
    fps,
    mode: 'Region',
    region,
    outputFormat: opts.outputFormat ?? 'Mp4',
    audioEnabled: opts.audioEnabled ?? false,
  }
}

/// 开始录屏
export async function startRecorder(config: RecorderConfig): Promise<void> {
  return invoke('start_recorder', { config })
}

/// 停止录屏，返回视频文件路径（MP4 或 GIF）
export async function stopRecorder(): Promise<string> {
  return invoke<string>('stop_recorder')
}

/// 取消录屏
export async function cancelRecorder(): Promise<void> {
  return invoke('cancel_recorder')
}

/// 查询录屏状态
export async function recorderState(): Promise<RecorderState> {
  return invoke<RecorderState>('recorder_state')
}
