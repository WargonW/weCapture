import { invoke } from '@tauri-apps/api/core'
import type { CaptureRegion, MonitorInfo, ScreenshotResult } from '../types/capture'

/// 全屏截图：可选指定显示器 id（不传=主显示器），返回 Base64 PNG
export async function captureFullscreen(monitorId?: number): Promise<ScreenshotResult> {
  return invoke<ScreenshotResult>('capture_fullscreen', { monitorId: monitorId ?? null })
}

/// 区域截图：传入选区 + 可选显示器 id，返回 Base64 PNG
export async function captureRegion(
  region: CaptureRegion,
  monitorId?: number,
): Promise<ScreenshotResult> {
  return invoke<ScreenshotResult>('capture_region', {
    region,
    monitorId: monitorId ?? null,
  })
}

/// 获取显示器数量
export async function monitorCount(): Promise<number> {
  return invoke<number>('monitor_count')
}

/// 列出所有显示器信息
export async function listMonitors(): Promise<MonitorInfo[]> {
  return invoke<MonitorInfo[]>('list_monitors')
}

/// 保存截图到文件，返回保存路径
export async function saveToFile(imageData: string): Promise<string> {
  return invoke<string>('save_to_file', { imageData })
}

/// 复制截图到剪贴板
export async function copyToClipboard(imageData: string): Promise<void> {
  return invoke('copy_to_clipboard', { imageData })
}
