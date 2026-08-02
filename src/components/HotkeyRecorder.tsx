import { useState, useCallback, useEffect } from 'react'
import { Chip, Box } from '@mui/material'

export interface HotkeyRecorderProps {
  /// 当前快捷键值
  value: string
  /// 捕获到新快捷键时回调
  onCapture: (shortcut: string) => void
  /// 是否禁用
  disabled?: boolean
}

/// 修饰键按下时 e.key 的取值
const MODIFIER_KEYS = ['Control', 'Shift', 'Alt', 'Meta']

/// 标准化主键为 Tauri Shortcut 解析支持的格式
export function normalizeKey(key: string): string | null {
  // 单字母 → 大写
  if (/^[a-z]$/i.test(key)) return key.toUpperCase()
  // 数字
  if (/^[0-9]$/.test(key)) return key
  // F1-F12
  if (/^F([1-9]|1[0-2])$/.test(key)) return key
  // 方向键
  const arrowMap: Record<string, string> = {
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
  }
  if (arrowMap[key]) return arrowMap[key]
  return null
}

/// 从键盘事件格式化快捷键字符串
/// - 纯修饰键、Esc、无修饰键、无效主键均返回 null
export function formatShortcut(e: {
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
  metaKey: boolean
  key: string
}): string | null {
  if (e.key === 'Escape') return null
  if (MODIFIER_KEYS.includes(e.key)) return null

  const mods: string[] = []
  if (e.ctrlKey) mods.push('Ctrl')
  if (e.shiftKey) mods.push('Shift')
  if (e.altKey) mods.push('Alt')
  if (e.metaKey) mods.push('Super')

  const mainKey = normalizeKey(e.key)
  if (!mainKey) return null
  // 至少需要一个修饰键，避免单键注册为全局快捷键引发冲突
  if (mods.length === 0) return null

  return [...mods, mainKey].join('+')
}

export default function HotkeyRecorder({
  value,
  onCapture,
  disabled = false,
}: HotkeyRecorderProps) {
  const [recording, setRecording] = useState(false)

  const handleKeydown = useCallback(
    (e: KeyboardEvent) => {
      if (!recording) return
      e.preventDefault()
      if (e.key === 'Escape') {
        setRecording(false)
        return
      }
      const sc = formatShortcut(e)
      if (sc) {
        setRecording(false)
        onCapture(sc)
      }
    },
    [recording, onCapture],
  )

  useEffect(() => {
    if (!recording) return
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [recording, handleKeydown])

  return (
    <Box data-testid="hotkey-recorder">
      <Chip
        label={recording ? '按下快捷键...（Esc 取消）' : value}
        onClick={() => !disabled && setRecording(true)}
        color={recording ? 'primary' : 'default'}
        clickable={!disabled}
        disabled={disabled}
        data-testid="hotkey-chip"
      />
    </Box>
  )
}
