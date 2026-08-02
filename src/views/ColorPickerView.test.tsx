import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import ColorPickerView from './ColorPickerView'

// 模拟 @tauri-apps/api/window
const closeWindowMock = vi.fn()
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ label: 'color-picker-test' }),
}))

// 模拟 color.service
const capturePixelMock = vi.fn()
const copyTextMock = vi.fn()
vi.mock('../services/color.service', () => ({
  capturePixel: (...args: unknown[]) => capturePixelMock(...args),
  toHex: (c: { r: number; g: number; b: number }) =>
    `#${[c.r, c.g, c.b].map((n) => n.toString(16).padStart(2, '0').toUpperCase()).join('')}`,
  toRgbString: (c: { r: number; g: number; b: number }) => `rgb(${c.r},${c.g},${c.b})`,
  copyText: (...args: unknown[]) => copyTextMock(...args),
}))

// 模拟 window.service
vi.mock('../services/window.service', () => ({
  closeWindow: (...args: unknown[]) => closeWindowMock(...args),
}))

const theme = createTheme()

const renderView = () =>
  render(
    <ThemeProvider theme={theme}>
      <ColorPickerView />
    </ThemeProvider>,
  )

const RED = { r: 255, g: 0, b: 0 }

describe('ColorPickerView 取色器', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturePixelMock.mockResolvedValue(RED)
    copyTextMock.mockResolvedValue(undefined)
    closeWindowMock.mockResolvedValue(undefined)
  })

  describe('初始渲染', () => {
    it('应渲染取色器容器', () => {
      renderView()
      expect(screen.getByTestId('color-picker')).toBeInTheDocument()
    })

    it('应显示操作提示', () => {
      renderView()
      expect(screen.getByTestId('color-hint')).toHaveTextContent('点击采集')
      expect(screen.getByTestId('color-hint')).toHaveTextContent('Esc 取消')
    })

    it('应存在放大镜和预览块', () => {
      renderView()
      expect(screen.getByTestId('color-lens')).toBeInTheDocument()
      expect(screen.getByTestId('color-preview')).toBeInTheDocument()
    })
  })

  describe('鼠标移动取色', () => {
    it('鼠标移动应调用 capturePixel 传 screenX/screenY', async () => {
      renderView()
      fireEvent.mouseMove(window, { screenX: 100, screenY: 200 })

      await waitFor(() => {
        expect(capturePixelMock).toHaveBeenCalledWith(100, 200)
      })
    })

    it('取色完成后应显示 HEX 色值', async () => {
      renderView()
      fireEvent.mouseMove(window, { screenX: 50, screenY: 60 })

      await waitFor(() => {
        expect(screen.getByText('#FF0000')).toBeInTheDocument()
      })
    })

    it('取色完成后应显示 rgb 色值', async () => {
      renderView()
      fireEvent.mouseMove(window, { screenX: 50, screenY: 60 })

      await waitFor(() => {
        expect(screen.getByText('rgb(255,0,0)')).toBeInTheDocument()
      })
    })

    it('取色失败应显示错误', async () => {
      capturePixelMock.mockRejectedValue(new Error('取色失败'))
      renderView()
      fireEvent.mouseMove(window, { screenX: 50, screenY: 60 })

      await waitFor(() => {
        expect(screen.getByTestId('color-error')).toHaveTextContent('取色失败')
      })
    })

    it('节流：连续多次移动只取色一次', async () => {
      renderView()
      // 连续移动（同毫秒内，应被节流）
      await act(async () => {
        fireEvent.mouseMove(window, { screenX: 10, screenY: 10 })
        fireEvent.mouseMove(window, { screenX: 20, screenY: 20 })
        fireEvent.mouseMove(window, { screenX: 30, screenY: 30 })
      })

      expect(capturePixelMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('点击采集', () => {
    it('点击应复制当前 HEX 并关闭窗口', async () => {
      renderView()
      // 先移动取一次色
      fireEvent.mouseMove(window, { screenX: 100, screenY: 100 })
      await waitFor(() => {
        expect(screen.getByText('#FF0000')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByTestId('color-picker'))

      await waitFor(() => {
        expect(copyTextMock).toHaveBeenCalledWith('#FF0000')
      })
    })

    it('无颜色时点击不应触发复制', () => {
      renderView()
      // 不移动鼠标，color 为 null
      fireEvent.click(screen.getByTestId('color-picker'))
      expect(copyTextMock).not.toHaveBeenCalled()
    })

    it('采集成功应显示提示', async () => {
      renderView()
      fireEvent.mouseMove(window, { screenX: 100, screenY: 100 })
      await waitFor(() => {
        expect(screen.getByText('#FF0000')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByTestId('color-picker'))

      await waitFor(() => {
        expect(screen.getByTestId('color-message')).toHaveTextContent('已复制')
      })
    })

    it('采集后应延时关闭窗口', async () => {
      renderView()
      fireEvent.mouseMove(window, { screenX: 100, screenY: 100 })
      await waitFor(() => {
        expect(screen.getByText('#FF0000')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByTestId('color-picker'))

      // copyText 是 async，等它完成后才会 setTimeout
      await waitFor(() => {
        expect(copyTextMock).toHaveBeenCalledWith('#FF0000')
      })

      // 未到 300ms 不关闭
      expect(closeWindowMock).not.toHaveBeenCalled()
      // 等待 setTimeout 触发（真实定时器）
      await new Promise((r) => setTimeout(r, 350))
      expect(closeWindowMock).toHaveBeenCalledWith('color-picker-test')
    })
  })

  describe('Esc 取消', () => {
    it('按 Esc 应关闭窗口', () => {
      renderView()
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(closeWindowMock).toHaveBeenCalledWith('color-picker-test')
    })

    it('按非 Esc 键不应关闭', () => {
      renderView()
      fireEvent.keyDown(window, { key: 'Enter' })
      expect(closeWindowMock).not.toHaveBeenCalled()
    })
  })
})
