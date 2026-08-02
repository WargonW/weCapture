import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CaptureView from './CaptureView'
import type { ScreenshotResult } from '../types/capture'

// 模拟 capture.service
const captureRegionMock = vi.fn()
vi.mock('../services/capture.service', () => ({
  captureRegion: (...args: unknown[]) => captureRegionMock(...args),
}))

// 模拟 window.service（截图完成后关闭窗口）
const closeWindowMock = vi.fn()
vi.mock('../services/window.service', () => ({
  closeWindow: (...args: unknown[]) => closeWindowMock(...args),
}))

const theme = createTheme()

const renderView = () =>
  render(
    <ThemeProvider theme={theme}>
      <CaptureView />
    </ThemeProvider>,
  )

// 模拟截图返回结果
const fakeResult: ScreenshotResult = {
  imageData: 'iVBORw0KGgo=',
  width: 200,
  height: 150,
}

describe('CaptureView 交互式截图浮层', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    captureRegionMock.mockResolvedValue(fakeResult)
  })

  describe('初始状态', () => {
    it('应渲染截图浮层容器', () => {
      renderView()
      expect(screen.getByTestId('capture-overlay')).toBeInTheDocument()
    })

    it('初始状态不显示选区框', () => {
      renderView()
      expect(screen.queryByTestId('selection-box')).not.toBeInTheDocument()
    })

    it('初始状态不显示操作栏', () => {
      renderView()
      expect(screen.queryByTestId('capture-toolbar')).not.toBeInTheDocument()
    })
  })

  describe('拖拽选区', () => {
    it('鼠标按下并移动后应显示选区框', () => {
      renderView()
      const overlay = screen.getByTestId('capture-overlay')

      // 模拟拖拽：按下 → 移动
      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100 })
      fireEvent.mouseMove(overlay, { clientX: 200, clientY: 200 })

      expect(screen.getByTestId('selection-box')).toBeInTheDocument()
    })

    it('选区框应反映拖拽的坐标和尺寸', () => {
      renderView()
      const overlay = screen.getByTestId('capture-overlay')

      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100 })
      fireEvent.mouseMove(overlay, { clientX: 300, clientY: 200 })

      const selection = screen.getByTestId('selection-box')
      expect(selection).toHaveStyle({ left: '100px', top: '100px' })
      expect(selection).toHaveStyle({ width: '200px', height: '100px' })
    })

    it('反向拖拽（从右下到左上）应正确计算选区', () => {
      renderView()
      const overlay = screen.getByTestId('capture-overlay')

      fireEvent.mouseDown(overlay, { clientX: 300, clientY: 200 })
      fireEvent.mouseMove(overlay, { clientX: 100, clientY: 100 })

      const selection = screen.getByTestId('selection-box')
      expect(selection).toHaveStyle({ left: '100px', top: '100px' })
      expect(selection).toHaveStyle({ width: '200px', height: '100px' })
    })

    it('鼠标释放后应显示操作栏', () => {
      renderView()
      const overlay = screen.getByTestId('capture-overlay')

      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100 })
      fireEvent.mouseMove(overlay, { clientX: 200, clientY: 200 })
      fireEvent.mouseUp(overlay)

      expect(screen.getByTestId('capture-toolbar')).toBeInTheDocument()
    })
  })

  describe('确认截图', () => {
    it('点击确认按钮应调用 captureRegion', async () => {
      renderView()
      const overlay = screen.getByTestId('capture-overlay')

      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100 })
      fireEvent.mouseMove(overlay, { clientX: 300, clientY: 200 })
      fireEvent.mouseUp(overlay)

      const confirmBtn = screen.getByTestId('confirm-capture')
      fireEvent.click(confirmBtn)

      await waitFor(() => {
        expect(captureRegionMock).toHaveBeenCalledWith({
          x: 100,
          y: 100,
          width: 200,
          height: 100,
        })
      })
    })

    it('截图完成后应显示结果预览', async () => {
      renderView()
      const overlay = screen.getByTestId('capture-overlay')

      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100 })
      fireEvent.mouseMove(overlay, { clientX: 300, clientY: 200 })
      fireEvent.mouseUp(overlay)

      fireEvent.click(screen.getByTestId('confirm-capture'))

      await waitFor(() => {
        expect(screen.getByTestId('capture-result')).toBeInTheDocument()
      })
    })
  })

  describe('取消截图', () => {
    it('点击取消按钮应清除选区', () => {
      renderView()
      const overlay = screen.getByTestId('capture-overlay')

      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100 })
      fireEvent.mouseMove(overlay, { clientX: 200, clientY: 200 })
      fireEvent.mouseUp(overlay)

      fireEvent.click(screen.getByTestId('cancel-capture'))

      expect(screen.queryByTestId('selection-box')).not.toBeInTheDocument()
      expect(screen.queryByTestId('capture-toolbar')).not.toBeInTheDocument()
    })
  })
})
