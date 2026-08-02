import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import MainView from './MainView'

// 模拟 window.service
const createWindowMock = vi.fn()
vi.mock('../services/window.service', () => ({
  createWindow: (...args: unknown[]) => createWindowMock(...args),
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
  })

  describe('截图卡片', () => {
    it('点击截图卡片应调用 createWindow("capture")', async () => {
      renderView()
      const screenshotCard = screen.getByText('截图').closest('button')
      expect(screenshotCard).toBeInTheDocument()

      fireEvent.click(screenshotCard!)

      await waitFor(() => {
        expect(createWindowMock).toHaveBeenCalledWith('capture')
      })
    })
  })

  describe('录屏卡片', () => {
    it('点击录屏卡片应调用 createWindow("recorder")', async () => {
      renderView()
      const recorderCard = screen.getByText('录屏').closest('button')
      expect(recorderCard).toBeInTheDocument()

      fireEvent.click(recorderCard!)

      await waitFor(() => {
        expect(createWindowMock).toHaveBeenCalledWith('recorder')
      })
    })
  })

  describe('贴图卡片', () => {
    it('点击贴图卡片应调用 createWindow("pin")', async () => {
      renderView()
      const pinCard = screen.getByText('贴图').closest('button')
      expect(pinCard).toBeInTheDocument()

      fireEvent.click(pinCard!)

      await waitFor(() => {
        expect(createWindowMock).toHaveBeenCalledWith('pin')
      })
    })
  })

  describe('取色卡片', () => {
    it('点击取色卡片应调用 createWindow("color-picker")', async () => {
      renderView()
      const colorCard = screen.getByText('取色').closest('button')
      expect(colorCard).toBeInTheDocument()

      fireEvent.click(colorCard!)

      await waitFor(() => {
        expect(createWindowMock).toHaveBeenCalledWith('color-picker')
      })
    })
  })

  describe('快捷键提示', () => {
    it('截图卡片应显示 Ctrl+Shift+S 快捷键', () => {
      renderView()
      expect(screen.getByText('Ctrl+Shift+S')).toBeInTheDocument()
    })
  })
})
