/// 截图快捷键（与 Rust 端 services::shortcut_service::CAPTURE_SHORTCUT 保持一致）
export const CAPTURE_SHORTCUT = 'Ctrl+Shift+S'

/// 快捷键展示信息
export interface ShortcutDisplay {
  /// 按键序列，如 ['Ctrl', 'Shift', 'S']
  keys: string[]
  /// 原始展示文案，如 'Ctrl+Shift+S'
  label: string
}

/// 将快捷键字符串按 '+' 拆分为按键序列
export function parseShortcut(shortcut: string): string[] {
  return shortcut.split('+')
}

/// 返回截图快捷键的展示信息
export function getCaptureShortcutDisplay(): ShortcutDisplay {
  return {
    keys: parseShortcut(CAPTURE_SHORTCUT),
    label: CAPTURE_SHORTCUT,
  }
}
