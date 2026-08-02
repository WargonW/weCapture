import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import SettingsView from './SettingsView'
import { DEFAULT_SHORTCUTS } from '../services/shortcut.service'

// 模拟 shortcut.service
const getShortcutsMock = vi.fn()
const updateShortcutMock = vi.fn()
vi.mock('../services/shortcut.service', async () => {
  const actual = await vi.importActual<typeof import('../services/shortcut.service')>(
    '../services/shortcut.service',
  )
  return {
    ...actual,
    getShortcuts: (...args: unknown[]) => getShortcutsMock(...args),
    updateShortcut: (...args: unknown[]) => updateShortcutMock(...args),
  }
})

const theme = createTheme()

const renderView = (open = true, onClose = vi.fn()) =>
  render(
    <ThemeProvider theme={theme}>
      <SettingsView open={open} onClose={onClose} />
    </ThemeProvider>,
  )

describe('SettingsView 快捷键设置', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getShortcutsMock.mockResolvedValue({ ...DEFAULT_SHORTCUTS })
    updateShortcutMock.mockResolvedValue(undefined)
  })

  describe('初始渲染', () => {
    it('open 时应渲染设置弹窗', async () => {
      renderView()
      expect(screen.getByTestId('settings-dialog')).toBeInTheDocument()
      await waitFor(() => {
        expect(getShortcutsMock).toHaveBeenCalled()
      })
    })

    it('应显示 4 个功能项', async () => {
      renderView()
      await waitFor(() => {
        expect(screen.getByTestId('shortcut-row-screenshot')).toBeInTheDocument()
        expect(screen.getByTestId('shortcut-row-recorder')).toBeInTheDocument()
        expect(screen.getByTestId('shortcut-row-pin')).toBeInTheDocument()
        expect(screen.getByTestId('shortcut-row-color-picker')).toBeInTheDocument()
      })
    })

    it('应显示功能标签', async () => {
      renderView()
      await waitFor(() => {
        expect(screen.getByText('截图')).toBeInTheDocument()
        expect(screen.getByText('录屏')).toBeInTheDocument()
        expect(screen.getByText('贴图')).toBeInTheDocument()
        expect(screen.getByText('取色')).toBeInTheDocument()
      })
    })
  })

  describe('加载配置', () => {
    it('打开时应调用 getShortcuts', async () => {
      renderView()
      await waitFor(() => {
        expect(getShortcutsMock).toHaveBeenCalledTimes(1)
      })
    })

    it('加载完成后应显示后端返回的快捷键', async () => {
      getShortcutsMock.mockResolvedValue({
        screenshot: 'Ctrl+Alt+S',
        recorder: 'Ctrl+Alt+R',
        pin: 'Ctrl+Alt+P',
        'color-picker': 'Ctrl+Alt+C',
      })
      renderView()
      await waitFor(() => {
        expect(screen.getByText('Ctrl+Alt+S')).toBeInTheDocument()
      })
    })

    it('加载失败应显示错误', async () => {
      getShortcutsMock.mockRejectedValue(new Error('加载失败'))
      renderView()
      await waitFor(() => {
        expect(screen.getByTestId('settings-error')).toHaveTextContent('加载失败')
      })
    })
  })

  describe('更新快捷键', () => {
    it('捕获新快捷键应调用 updateShortcut 并更新显示', async () => {
      renderView()
      await waitFor(() => {
        expect(screen.getByTestId('shortcut-row-screenshot')).toBeInTheDocument()
      })

      // 点击截图行的 recorder 进入录制
      const chip = screen.getByText('Ctrl+Shift+S')
      fireEvent.click(chip)

      // 按下新组合键
      fireEvent.keyDown(window, { altKey: true, key: 's' })

      await waitFor(() => {
        expect(updateShortcutMock).toHaveBeenCalledWith('screenshot', 'Alt+S')
      })
      // 显示更新为新值
      await waitFor(() => {
        expect(screen.getByText('Alt+S')).toBeInTheDocument()
      })
    })

    it('更新失败应显示错误', async () => {
      updateShortcutMock.mockRejectedValue(new Error('注册失败'))
      renderView()
      await waitFor(() => {
        expect(screen.getByText('Ctrl+Shift+S')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Ctrl+Shift+S'))
      fireEvent.keyDown(window, { altKey: true, key: 's' })

      await waitFor(() => {
        expect(screen.getByTestId('settings-error')).toHaveTextContent('注册失败')
      })
    })
  })

  describe('关闭', () => {
    it('点击关闭按钮应调用 onClose', async () => {
      const onClose = vi.fn()
      renderView(true, onClose)
      await waitFor(() => {
        expect(screen.getByTestId('close-settings')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByTestId('close-settings'))
      expect(onClose).toHaveBeenCalled()
    })
  })
})
