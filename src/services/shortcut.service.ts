import { invoke } from '@tauri-apps/api/core'

/// 快捷键动作类型（与 Rust 端 ShortcutAction.as_str 一致）
export type ShortcutAction = 'screenshot' | 'recorder' | 'pin' | 'color-picker'

/// 快捷键配置（与 Rust 端 ShortcutConfig 一致）
export interface ShortcutConfig {
  screenshot: string
  recorder: string
  pin: string
  'color-picker': string
}

/// 默认快捷键配置（与 Rust 端 ShortcutConfig::default 一致）
export const DEFAULT_SHORTCUTS: ShortcutConfig = {
  screenshot: 'Ctrl+Shift+S',
  recorder: 'Ctrl+Shift+R',
  pin: 'Ctrl+Shift+P',
  'color-picker': 'Ctrl+Shift+C',
}

/// 截图快捷键默认值（保持向后兼容）
export const CAPTURE_SHORTCUT = DEFAULT_SHORTCUTS.screenshot

/// 快捷键展示信息
export interface ShortcutDisplay {
  keys: string[]
  label: string
}

/// 将快捷键字符串按 '+' 拆分为按键序列
export function parseShortcut(shortcut: string): string[] {
  return shortcut.split('+')
}

/// 返回截图快捷键的展示信息（基于默认值）
export function getCaptureShortcutDisplay(): ShortcutDisplay {
  return {
    keys: parseShortcut(CAPTURE_SHORTCUT),
    label: CAPTURE_SHORTCUT,
  }
}

/// 根据动作获取其快捷键
export function getShortcutByAction(config: ShortcutConfig, action: ShortcutAction): string {
  return config[action]
}

/// 获取当前快捷键配置（从后端读取）
export async function getShortcuts(): Promise<ShortcutConfig> {
  return invoke<ShortcutConfig>('get_shortcuts')
}

/// 更新指定动作的快捷键
export async function updateShortcut(
  action: ShortcutAction,
  newShortcut: string,
): Promise<void> {
  return invoke('update_shortcut', { action, newShortcut })
}
