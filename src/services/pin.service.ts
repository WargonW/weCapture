import { invoke } from '@tauri-apps/api/core'
import { createWindow, closeWindow } from './window.service'

/// 暂存贴图数据并创建贴图窗口
/// - suffix 用时间戳，Rust 端生成 label = "pin-{suffix}"
/// - stash 用完整 label 作 key，与窗口真实 label 一致
/// - 返回窗口 label
export async function pinImage(dataUrl: string): Promise<string> {
  const suffix = `${Date.now()}`
  const label = `pin-${suffix}`
  // 先暂存数据，再创建窗口，避免窗口加载时数据未就绪
  await invoke('stash_pin_image', { label, dataUrl })
  await createWindow('pin', suffix)
  return label
}

/// 取出贴图数据（贴图窗口启动时调用，取后即删）
export async function takePinImage(label: string): Promise<string | null> {
  return invoke<string | null>('take_pin_image', { label })
}

/// 关闭指定贴图窗口
export async function closePinWindow(label: string): Promise<void> {
  return closeWindow(label)
}
