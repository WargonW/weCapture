import { describe, it, expect } from 'vitest'
import {
  CAPTURE_SHORTCUT,
  parseShortcut,
  getCaptureShortcutDisplay,
} from './shortcut.service'

describe('shortcut.service', () => {
  describe('CAPTURE_SHORTCUT 常量', () => {
    it('应为 Ctrl+Shift+S', () => {
      expect(CAPTURE_SHORTCUT).toBe('Ctrl+Shift+S')
    })
  })

  describe('parseShortcut', () => {
    it('应按 + 拆分快捷键', () => {
      expect(parseShortcut('Ctrl+Shift+S')).toEqual(['Ctrl', 'Shift', 'S'])
    })

    it('单键应返回单元素数组', () => {
      expect(parseShortcut('F1')).toEqual(['F1'])
    })

    it('空字符串应返回单元素数组', () => {
      expect(parseShortcut('')).toEqual([''])
    })
  })

  describe('getCaptureShortcutDisplay', () => {
    it('应返回按键序列和原始文案', () => {
      const display = getCaptureShortcutDisplay()
      expect(display.keys).toEqual(['Ctrl', 'Shift', 'S'])
      expect(display.label).toBe('Ctrl+Shift+S')
    })

    it('label 应与常量一致', () => {
      expect(getCaptureShortcutDisplay().label).toBe(CAPTURE_SHORTCUT)
    })
  })
})
