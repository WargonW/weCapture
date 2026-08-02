import { invoke } from '@tauri-apps/api/core'
import type { CaptureRegion, ScreenshotResult } from '../types/capture'

/// 全屏截图：采集主显示器，返回 Base64 PNG
export async function captureFullscreen(): Promise<ScreenshotResult> {
  return invoke<ScreenshotResult>('capture_fullscreen')
}

/// 区域截图：传入选区，返回 Base64 PNG
export async function captureRegion(region: CaptureRegion): Promise<ScreenshotResult> {
  return invoke<ScreenshotResult>('capture_region', { region })
}

/// 获取显示器数量
export async function monitorCount(): Promise<number> {
  return invoke<number>('monitor_count')
}
