import { invoke } from '@tauri-apps/api/core'

/// 创建新窗口
export async function createWindow(
  windowType: string,
  labelSuffix?: string,
): Promise<string> {
  return invoke<string>('create_window', {
    windowTypeStr: windowType,
    labelSuffix: labelSuffix ?? null,
  })
}

/// 关闭窗口
export async function closeWindow(label: string): Promise<void> {
  return invoke('close_window', { label })
}

/// 设置窗口置顶
export async function setAlwaysOnTop(
  label: string,
  onTop: boolean,
): Promise<void> {
  return invoke('set_always_on_top', { label, onTop })
}
