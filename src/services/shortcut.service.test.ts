import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  CAPTURE_SHORTCUT,
  DEFAULT_SHORTCUTS,
  parseShortcut,
  getCaptureShortcutDisplay,
  getShortcutByAction,
  getShortcuts,
  updateShortcut,
} from './shortcut.service'
import type { ShortcutConfig } from './shortcut.service'

// 模拟 @tauri-apps/api/core 的 invoke
const invokeMock = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}))

describe('shortcut.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('DEFAULT_SHORTCUTS 默认值', () => {
    it('应包含 4 个功能的默认快捷键', () => {
      expect(DEFAULT_SHORTCUTS.screenshot).toBe('Ctrl+Shift+S')
      expect(DEFAULT_SHORTCUTS.recorder).toBe('Ctrl+Shift+R')
      expect(DEFAULT_SHORTCUTS.pin).toBe('Ctrl+Shift+P')
      expect(DEFAULT_SHORTCUTS['color-picker']).toBe('Ctrl+Shift+C')
    })
  })

  describe('CAPTURE_SHORTCUT 常量', () => {
    it('应为截图默认快捷键', () => {
      expect(CAPTURE_SHORTCUT).toBe('Ctrl+Shift+S')
      expect(CAPTURE_SHORTCUT).toBe(DEFAULT_SHORTCUTS.screenshot)
    })
  })

  describe('parseShortcut', () => {
    it('应按 + 拆分快捷键', () => {
      expect(parseShortcut('Ctrl+Shift+S')).toEqual(['Ctrl', 'Shift', 'S'])
    })

    it('单键应返回单元素数组', () => {
      expect(parseShortcut('F1')).toEqual(['F1'])
    })
  })

  describe('getCaptureShortcutDisplay', () => {
    it('应返回按键序列和原始文案', () => {
      const display = getCaptureShortcutDisplay()
      expect(display.keys).toEqual(['Ctrl', 'Shift', 'S'])
      expect(display.label).toBe('Ctrl+Shift+S')
    })
  })

  describe('getShortcutByAction', () => {
    it('应根据动作返回对应快捷键', () => {
      const config: ShortcutConfig = {
        screenshot: 'Ctrl+Alt+S',
        recorder: 'Ctrl+Alt+R',
        pin: 'Ctrl+Alt+P',
        'color-picker': 'Ctrl+Alt+C',
      }
      expect(getShortcutByAction(config, 'screenshot')).toBe('Ctrl+Alt+S')
      expect(getShortcutByAction(config, 'recorder')).toBe('Ctrl+Alt+R')
      expect(getShortcutByAction(config, 'pin')).toBe('Ctrl+Alt+P')
      expect(getShortcutByAction(config, 'color-picker')).toBe('Ctrl+Alt+C')
    })
  })

  describe('getShortcuts', () => {
    it('应调用 get_shortcuts 命令', async () => {
      const fakeConfig: ShortcutConfig = { ...DEFAULT_SHORTCUTS }
      invokeMock.mockResolvedValue(fakeConfig)

      const result = await getShortcuts()

      expect(invokeMock).toHaveBeenCalledWith('get_shortcuts')
      expect(result).toEqual(fakeConfig)
    })
  })

  describe('updateShortcut', () => {
    it('应调用 update_shortcut 命令并传递 action 和 newShortcut', async () => {
      invokeMock.mockResolvedValue(undefined)

      await updateShortcut('screenshot', 'Ctrl+Alt+S')

      expect(invokeMock).toHaveBeenCalledWith('update_shortcut', {
        action: 'screenshot',
        newShortcut: 'Ctrl+Alt+S',
      })
    })

    it('应支持 color-picker 动作', async () => {
      invokeMock.mockResolvedValue(undefined)

      await updateShortcut('color-picker', 'Ctrl+Alt+C')

      expect(invokeMock).toHaveBeenCalledWith('update_shortcut', {
        action: 'color-picker',
        newShortcut: 'Ctrl+Alt+C',
      })
    })
  })
})
