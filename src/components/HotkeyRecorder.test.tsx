import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import HotkeyRecorder, {
  normalizeKey,
  formatShortcut,
} from './HotkeyRecorder'

const theme = createTheme()

const renderComp = (props: Parameters<typeof HotkeyRecorder>[0]) =>
  render(
    <ThemeProvider theme={theme}>
      <HotkeyRecorder {...props} />
    </ThemeProvider>,
  )

describe('normalizeKey', () => {
  it('单字母应大写', () => {
    expect(normalizeKey('s')).toBe('S')
    expect(normalizeKey('A')).toBe('A')
  })

  it('数字应原样返回', () => {
    expect(normalizeKey('1')).toBe('1')
    expect(normalizeKey('0')).toBe('0')
  })

  it('F1-F12 应原样返回', () => {
    expect(normalizeKey('F1')).toBe('F1')
    expect(normalizeKey('F12')).toBe('F12')
  })

  it('方向键应转为 Up/Down/Left/Right', () => {
    expect(normalizeKey('ArrowUp')).toBe('Up')
    expect(normalizeKey('ArrowDown')).toBe('Down')
    expect(normalizeKey('ArrowLeft')).toBe('Left')
    expect(normalizeKey('ArrowRight')).toBe('Right')
  })

  it('无效键应返回 null', () => {
    expect(normalizeKey('Enter')).toBeNull()
    expect(normalizeKey(' ')).toBeNull()
  })
})

describe('formatShortcut', () => {
  const ev = (overrides: Partial<KeyboardEventInit> = {}) => ({
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
    key: '',
    ...overrides,
  })

  it('Ctrl+Shift+S 应格式化为 Ctrl+Shift+S', () => {
    expect(
      formatShortcut(ev({ ctrlKey: true, shiftKey: true, key: 's' })),
    ).toBe('Ctrl+Shift+S')
  })

  it('纯修饰键应返回 null', () => {
    expect(formatShortcut(ev({ ctrlKey: true, key: 'Control' }))).toBeNull()
    expect(formatShortcut(ev({ shiftKey: true, key: 'Shift' }))).toBeNull()
  })

  it('Esc 应返回 null', () => {
    expect(formatShortcut(ev({ key: 'Escape' }))).toBeNull()
  })

  it('无修饰键应返回 null', () => {
    expect(formatShortcut(ev({ key: 's' }))).toBeNull()
  })

  it('Alt+P 应格式化为 Alt+P', () => {
    expect(formatShortcut(ev({ altKey: true, key: 'p' }))).toBe('Alt+P')
  })

  it('无效主键应返回 null', () => {
    expect(formatShortcut(ev({ ctrlKey: true, key: 'Enter' }))).toBeNull()
  })

  it('修饰键顺序应为 Ctrl+Shift+Alt+Super', () => {
    expect(
      formatShortcut(
        ev({ ctrlKey: true, shiftKey: true, altKey: true, metaKey: true, key: 'k' }),
      ),
    ).toBe('Ctrl+Shift+Alt+Super+K')
  })
})

describe('HotkeyRecorder 组件', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应显示当前快捷键值', () => {
    renderComp({ value: 'Ctrl+Shift+S', onCapture: vi.fn() })
    expect(screen.getByTestId('hotkey-chip')).toHaveTextContent('Ctrl+Shift+S')
  })

  it('点击后进入录制状态', () => {
    renderComp({ value: 'Ctrl+Shift+S', onCapture: vi.fn() })
    fireEvent.click(screen.getByTestId('hotkey-chip'))
    expect(screen.getByTestId('hotkey-chip')).toHaveTextContent('按下快捷键')
  })

  it('录制中按下组合键应调用 onCapture 并退出录制', async () => {
    const onCapture = vi.fn()
    renderComp({ value: 'Ctrl+Shift+S', onCapture })
    fireEvent.click(screen.getByTestId('hotkey-chip'))

    fireEvent.keyDown(window, { ctrlKey: true, shiftKey: true, key: 's' })

    await waitFor(() => {
      expect(onCapture).toHaveBeenCalledWith('Ctrl+Shift+S')
    })
    // 退出录制，恢复显示
    expect(screen.getByTestId('hotkey-chip')).toHaveTextContent('Ctrl+Shift+S')
  })

  it('录制中按 Esc 应取消录制不触发 onCapture', () => {
    const onCapture = vi.fn()
    renderComp({ value: 'Ctrl+Shift+S', onCapture })
    fireEvent.click(screen.getByTestId('hotkey-chip'))

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onCapture).not.toHaveBeenCalled()
    expect(screen.getByTestId('hotkey-chip')).toHaveTextContent('Ctrl+Shift+S')
  })

  it('未进入录制时按键不应触发 onCapture', () => {
    const onCapture = vi.fn()
    renderComp({ value: 'Ctrl+Shift+S', onCapture })

    fireEvent.keyDown(window, { ctrlKey: true, shiftKey: true, key: 's' })
    expect(onCapture).not.toHaveBeenCalled()
  })

  it('disabled 时点击不应进入录制', () => {
    renderComp({ value: 'Ctrl+Shift+S', onCapture: vi.fn(), disabled: true })
    fireEvent.click(screen.getByTestId('hotkey-chip'))
    expect(screen.getByTestId('hotkey-chip')).toHaveTextContent('Ctrl+Shift+S')
  })

  it('捕获新快捷键后应显示新值', async () => {
    const onCapture = vi.fn()
    renderComp({ value: 'Ctrl+Shift+S', onCapture })
    fireEvent.click(screen.getByTestId('hotkey-chip'))

    fireEvent.keyDown(window, { altKey: true, key: 'p' })

    await waitFor(() => {
      expect(onCapture).toHaveBeenCalledWith('Alt+P')
    })
  })
})
