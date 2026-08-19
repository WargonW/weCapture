import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import MainView from './MainView'

// 模拟 window.service
const createWindowMock = vi.fn()
vi.mock('../services/window.service', () => ({
  createWindow: (...args: unknown[]) => createWindowMock(...args),
}))

// 模拟 shortcut.service（含真实默认值）
const getShortcutsMock = vi.fn()
vi.mock('../services/shortcut.service', async () => {
  const actual = await vi.importActual<typeof import('../services/shortcut.service')>(
    '../services/shortcut.service',
  )
  return {
    ...actual,
    getShortcuts: (...args: unknown[]) => getShortcutsMock(...args),
  }
})

// 模拟 SettingsView（隔离 MainView 单元，避免内部 Dialog 行为干扰）
vi.mock('./SettingsView', () => ({
  default: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div data-testid="settings-dialog">
        <button data-testid="close-settings" onClick={onClose} />
      </div>
    ) : null,
}))

const theme = createTheme()

const renderView = () =>
  render(
    <ThemeProvider theme={theme}>
      <MainView />
    </ThemeProvider>,
  )

describe('MainView 功能卡片点击', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createWindowMock.mockResolvedValue('capture')
    getShortcutsMock.mockResolvedValue({
      screenshot: 'Ctrl+Shift+S',
      recorder: 'Ctrl+Shift+R',
      pin: 'Ctrl+Shift+P',
      'color-picker': 'Ctrl+Shift+C',
    })
  })

  describe('截图工具', () => {
    it('点击截图工具项应调用 createWindow("capture")', async () => {
      renderView()
      const screenshotTool = screen.getByTestId('tool-item-screenshot')
      expect(screenshotTool).toBeInTheDocument()

      fireEvent.click(screenshotTool!)

      await waitFor(() => {
        expect(createWindowMock).toHaveBeenCalledWith('capture')
      })
    })
  })

  describe('录屏工具', () => {
    it('点击录屏工具项应调用 createWindow("recorder")', async () => {
      renderView()
      const recorderTool = screen.getByTestId('tool-item-recorder')
      expect(recorderTool).toBeInTheDocument()

      fireEvent.click(recorderTool!)

      await waitFor(() => {
        expect(createWindowMock).toHaveBeenCalledWith('recorder')
      })
    })
  })

  describe('贴图工具', () => {
    it('点击贴图工具项应调用 createWindow("pin")', async () => {
      renderView()
      const pinTool = screen.getByTestId('tool-item-pin')
      expect(pinTool).toBeInTheDocument()

      fireEvent.click(pinTool!)

      await waitFor(() => {
        expect(createWindowMock).toHaveBeenCalledWith('pin')
      })
    })
  })

  describe('取色工具', () => {
    it('点击取色工具项应调用 createWindow("color-picker")', async () => {
      renderView()
      const colorTool = screen.getByTestId('tool-item-color-picker')
      expect(colorTool).toBeInTheDocument()

      fireEvent.click(colorTool!)

      await waitFor(() => {
        expect(createWindowMock).toHaveBeenCalledWith('color-picker')
      })
    })
  })

  describe('快捷键提示', () => {
    it('截图卡片应显示后端返回的快捷键', async () => {
      renderView()
      await waitFor(() => {
        expect(screen.getByText('Ctrl+Shift+S')).toBeInTheDocument()
      })
    })

    it('应显示自定义后的快捷键', async () => {
      getShortcutsMock.mockResolvedValue({
        screenshot: 'Ctrl+Alt+S',
        recorder: 'Ctrl+Shift+R',
        pin: 'Ctrl+Shift+P',
        'color-picker': 'Ctrl+Shift+C',
      })
      renderView()
      await waitFor(() => {
        expect(screen.getByText('Ctrl+Alt+S')).toBeInTheDocument()
      })
    })

    it('加载失败应回退默认快捷键', async () => {
      getShortcutsMock.mockRejectedValue(new Error('fail'))
      renderView()
      await waitFor(() => {
        expect(screen.getByText('Ctrl+Shift+S')).toBeInTheDocument()
      })
    })
  })

  describe('设置入口', () => {
    it('应显示设置按钮', async () => {
      renderView()
      await waitFor(() => {
        expect(screen.getByTestId('open-settings')).toBeInTheDocument()
      })
    })

    it('点击设置按钮应打开设置弹窗', async () => {
      renderView()
      fireEvent.click(screen.getByTestId('open-settings'))
      await waitFor(() => {
        expect(screen.getByTestId('settings-dialog')).toBeInTheDocument()
      })
    })

    it('关闭设置弹窗后应重新加载配置', async () => {
      renderView()
      fireEvent.click(screen.getByTestId('open-settings'))
      await waitFor(() => {
        expect(screen.getByTestId('settings-dialog')).toBeInTheDocument()
      })
      const initialCalls = getShortcutsMock.mock.calls.length

      fireEvent.click(screen.getByTestId('close-settings'))

      await waitFor(() => {
        expect(getShortcutsMock.mock.calls.length).toBeGreaterThan(initialCalls)
      })
    })
  })
})
