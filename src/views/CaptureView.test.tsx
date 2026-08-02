import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CaptureView from './CaptureView'
import type { ScreenshotResult } from '../types/capture'

// 模拟 capture.service
const captureRegionMock = vi.fn()
const captureFullscreenMock = vi.fn()
const listMonitorsMock = vi.fn()
const saveToFileMock = vi.fn()
const copyToClipboardMock = vi.fn()
vi.mock('../services/capture.service', () => ({
  captureRegion: (...args: unknown[]) => captureRegionMock(...args),
  captureFullscreen: (...args: unknown[]) => captureFullscreenMock(...args),
  listMonitors: (...args: unknown[]) => listMonitorsMock(...args),
  saveToFile: (...args: unknown[]) => saveToFileMock(...args),
  copyToClipboard: (...args: unknown[]) => copyToClipboardMock(...args),
}))

// 模拟 composeImage
const composeImageMock = vi.fn()
vi.mock('../utils/composeImage', () => ({
  composeImage: (...args: unknown[]) => composeImageMock(...args),
}))

// 模拟 window.service（截图完成后关闭窗口）
const closeWindowMock = vi.fn()
vi.mock('../services/window.service', () => ({
  closeWindow: (...args: unknown[]) => closeWindowMock(...args),
}))

// 模拟 pin.service
const pinImageMock = vi.fn()
vi.mock('../services/pin.service', () => ({
  pinImage: (...args: unknown[]) => pinImageMock(...args),
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
    captureFullscreenMock.mockResolvedValue(fakeResult)
    // 默认返回空显示器列表（单屏场景）
    listMonitorsMock.mockResolvedValue([])
    saveToFileMock.mockResolvedValue('/home/user/snapmaster_123.png')
    copyToClipboardMock.mockResolvedValue(undefined)
    composeImageMock.mockResolvedValue('data:image/png;base64,composedData')
    pinImageMock.mockResolvedValue('pin-123')
  })

  describe('初始状态', () => {
    it('应渲染截图浮层容器', () => {
      renderView()
      expect(screen.getByTestId('capture-overlay')).toBeInTheDocument()
    })

    it('应渲染顶部工具栏', () => {
      renderView()
      expect(screen.getByTestId('capture-topbar')).toBeInTheDocument()
    })

    it('应渲染全屏截图按钮', () => {
      renderView()
      expect(screen.getByTestId('fullscreen-capture-btn')).toBeInTheDocument()
    })

    it('单屏场景不渲染显示器选择下拉', () => {
      renderView()
      expect(screen.queryByTestId('monitor-select')).not.toBeInTheDocument()
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

  describe('全屏截图', () => {
    it('点击全屏截图按钮应调用 captureFullscreen', async () => {
      renderView()
      const btn = screen.getByTestId('fullscreen-capture-btn')
      fireEvent.click(btn)
      await waitFor(() => {
        expect(captureFullscreenMock).toHaveBeenCalled()
      })
    })

    it('全屏截图完成应进入结果页', async () => {
      renderView()
      fireEvent.click(screen.getByTestId('fullscreen-capture-btn'))
      await waitFor(() => {
        expect(screen.getByTestId('capture-result')).toBeInTheDocument()
      })
    })

    it('全屏截图失败应显示错误', async () => {
      captureFullscreenMock.mockRejectedValueOnce('截图失败')
      renderView()
      fireEvent.click(screen.getByTestId('fullscreen-capture-btn'))
      await waitFor(() => {
        expect(screen.getByText('截图失败')).toBeInTheDocument()
      })
    })
  })

  describe('多屏显示器选择', () => {
    it('多屏场景应渲染显示器选择下拉', async () => {
      listMonitorsMock.mockResolvedValueOnce([
        { id: 1, name: 'Display 1', x: 0, y: 0, width: 1920, height: 1080, isPrimary: true },
        { id: 2, name: 'Display 2', x: 1920, y: 0, width: 1920, height: 1080, isPrimary: false },
      ])
      renderView()
      await waitFor(() => {
        expect(screen.getByTestId('monitor-select')).toBeInTheDocument()
      })
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
    it('点击确认按钮应调用 captureRegion（单屏场景 monitorId 为 undefined）', async () => {
      renderView()
      const overlay = screen.getByTestId('capture-overlay')

      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100 })
      fireEvent.mouseMove(overlay, { clientX: 300, clientY: 200 })
      fireEvent.mouseUp(overlay)

      const confirmBtn = screen.getByTestId('confirm-capture')
      fireEvent.click(confirmBtn)

      await waitFor(() => {
        expect(captureRegionMock).toHaveBeenCalledWith(
          {
            x: 100,
            y: 100,
            width: 200,
            height: 100,
          },
          undefined,
        )
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

  describe('保存截图', () => {
    it('截图结果页应显示保存按钮', async () => {
      renderView()
      const overlay = screen.getByTestId('capture-overlay')
      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100 })
      fireEvent.mouseMove(overlay, { clientX: 300, clientY: 200 })
      fireEvent.mouseUp(overlay)
      fireEvent.click(screen.getByTestId('confirm-capture'))

      await waitFor(() => {
        expect(screen.getByTestId('save-to-file')).toBeInTheDocument()
      })
    })

    it('点击保存按钮应先合成标注再调用 saveToFile', async () => {
      renderView()
      const overlay = screen.getByTestId('capture-overlay')
      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100 })
      fireEvent.mouseMove(overlay, { clientX: 300, clientY: 200 })
      fireEvent.mouseUp(overlay)
      fireEvent.click(screen.getByTestId('confirm-capture'))

      await waitFor(() => {
        expect(screen.getByTestId('save-to-file')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByTestId('save-to-file'))

      await waitFor(() => {
        expect(composeImageMock).toHaveBeenCalled()
        expect(saveToFileMock).toHaveBeenCalledWith('composedData')
      })
    })
  })

  describe('复制到剪贴板', () => {
    it('截图结果页应显示复制按钮', async () => {
      renderView()
      const overlay = screen.getByTestId('capture-overlay')
      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100 })
      fireEvent.mouseMove(overlay, { clientX: 300, clientY: 200 })
      fireEvent.mouseUp(overlay)
      fireEvent.click(screen.getByTestId('confirm-capture'))

      await waitFor(() => {
        expect(screen.getByTestId('copy-to-clipboard')).toBeInTheDocument()
      })
    })

    it('点击复制按钮应先合成标注再调用 copyToClipboard', async () => {
      renderView()
      const overlay = screen.getByTestId('capture-overlay')
      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100 })
      fireEvent.mouseMove(overlay, { clientX: 300, clientY: 200 })
      fireEvent.mouseUp(overlay)
      fireEvent.click(screen.getByTestId('confirm-capture'))

      await waitFor(() => {
        expect(screen.getByTestId('copy-to-clipboard')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByTestId('copy-to-clipboard'))

      await waitFor(() => {
        expect(composeImageMock).toHaveBeenCalled()
        expect(copyToClipboardMock).toHaveBeenCalledWith('composedData')
      })
    })
  })

  describe('贴图到桌面', () => {
    it('截图结果页应显示贴图按钮', async () => {
      renderView()
      const overlay = screen.getByTestId('capture-overlay')
      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100 })
      fireEvent.mouseMove(overlay, { clientX: 300, clientY: 200 })
      fireEvent.mouseUp(overlay)
      fireEvent.click(screen.getByTestId('confirm-capture'))

      await waitFor(() => {
        expect(screen.getByTestId('pin-to-desktop')).toBeInTheDocument()
      })
    })

    it('点击贴图按钮应先合成标注再调用 pinImage', async () => {
      renderView()
      const overlay = screen.getByTestId('capture-overlay')
      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100 })
      fireEvent.mouseMove(overlay, { clientX: 300, clientY: 200 })
      fireEvent.mouseUp(overlay)
      fireEvent.click(screen.getByTestId('confirm-capture'))

      await waitFor(() => {
        expect(screen.getByTestId('pin-to-desktop')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByTestId('pin-to-desktop'))

      await waitFor(() => {
        expect(composeImageMock).toHaveBeenCalled()
        expect(pinImageMock).toHaveBeenCalledWith('data:image/png;base64,composedData')
      })
    })

    it('贴图成功应显示提示', async () => {
      renderView()
      const overlay = screen.getByTestId('capture-overlay')
      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100 })
      fireEvent.mouseMove(overlay, { clientX: 300, clientY: 200 })
      fireEvent.mouseUp(overlay)
      fireEvent.click(screen.getByTestId('confirm-capture'))

      await waitFor(() => {
        expect(screen.getByTestId('pin-to-desktop')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByTestId('pin-to-desktop'))

      await waitFor(() => {
        expect(screen.getByTestId('capture-message')).toHaveTextContent('已贴图到桌面')
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

  // ========== 标注功能测试 ==========

  /// 辅助：完成截图进入结果页
  async function enterResultPage() {
    renderView()
    const overlay = screen.getByTestId('capture-overlay')
    fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100 })
    fireEvent.mouseMove(overlay, { clientX: 300, clientY: 200 })
    fireEvent.mouseUp(overlay)
    fireEvent.click(screen.getByTestId('confirm-capture'))
    await waitFor(() => {
      expect(screen.getByTestId('capture-result')).toBeInTheDocument()
    })
  }

  describe('标注工具栏', () => {
    it('结果页应显示标注工具栏', async () => {
      await enterResultPage()
      expect(screen.getByTestId('annotation-toolbar')).toBeInTheDocument()
    })

    it('默认工具模式为数字标注', async () => {
      await enterResultPage()
      const numberBtn = screen.getByTestId('tool-number')
      expect(numberBtn).toHaveAttribute('aria-pressed', 'true')
    })
  })

  describe('数字圆圈标注（默认模式）', () => {
    it('点击图片应放置数字圆圈标注，从1开始', async () => {
      await enterResultPage()

      const img = screen.getByAltText('截图结果')
      // 模拟 getBoundingClientRect
      Object.defineProperty(img, 'getBoundingClientRect', {
        value: () => ({ left: 0, top: 0, width: 200, height: 150, right: 200, bottom: 150 }),
      })

      fireEvent.click(img, { clientX: 50, clientY: 60 })

      const layer = screen.getByTestId('annotation-layer')
      const circles = layer.querySelectorAll('circle')
      expect(circles).toHaveLength(1)
      expect(circles[0]).toHaveAttribute('cx', '50')
      expect(circles[0]).toHaveAttribute('cy', '60')
      expect(circles[0]).toHaveAttribute('fill', '#F44336')
    })

    it('连续点击应递增序号', async () => {
      await enterResultPage()

      const img = screen.getByAltText('截图结果')
      Object.defineProperty(img, 'getBoundingClientRect', {
        value: () => ({ left: 0, top: 0, width: 200, height: 150, right: 200, bottom: 150 }),
      })

      fireEvent.click(img, { clientX: 10, clientY: 10 })
      fireEvent.click(img, { clientX: 50, clientY: 50 })
      fireEvent.click(img, { clientX: 100, clientY: 100 })

      const texts = screen.getByTestId('annotation-layer').querySelectorAll('text')
      expect(texts).toHaveLength(3)
      expect(texts[0]).toHaveTextContent('1')
      expect(texts[1]).toHaveTextContent('2')
      expect(texts[2]).toHaveTextContent('3')
    })

    it('默认颜色为红色 #F44336', async () => {
      await enterResultPage()

      const img = screen.getByAltText('截图结果')
      Object.defineProperty(img, 'getBoundingClientRect', {
        value: () => ({ left: 0, top: 0, width: 200, height: 150, right: 200, bottom: 150 }),
      })

      fireEvent.click(img, { clientX: 50, clientY: 60 })

      const circle = screen.getByTestId('annotation-layer').querySelector('circle')
      expect(circle).toHaveAttribute('fill', '#F44336')
    })
  })

  describe('颜色切换', () => {
    it('切换颜色后新标注使用新颜色', async () => {
      await enterResultPage()

      // 点击蓝色
      fireEvent.click(screen.getByTestId('color-#2196F3'))

      const img = screen.getByAltText('截图结果')
      Object.defineProperty(img, 'getBoundingClientRect', {
        value: () => ({ left: 0, top: 0, width: 200, height: 150, right: 200, bottom: 150 }),
      })

      fireEvent.click(img, { clientX: 50, clientY: 60 })

      const circle = screen.getByTestId('annotation-layer').querySelector('circle')
      expect(circle).toHaveAttribute('fill', '#2196F3')
    })
  })

  describe('撤销标注', () => {
    it('点击撤销应移除最后一个标注', async () => {
      await enterResultPage()

      const img = screen.getByAltText('截图结果')
      Object.defineProperty(img, 'getBoundingClientRect', {
        value: () => ({ left: 0, top: 0, width: 200, height: 150, right: 200, bottom: 150 }),
      })

      fireEvent.click(img, { clientX: 10, clientY: 10 })
      fireEvent.click(img, { clientX: 50, clientY: 50 })
      expect(screen.getByTestId('annotation-layer').querySelectorAll('circle')).toHaveLength(2)

      // 点击撤销按钮
      fireEvent.click(screen.getByTestId('undo-annotation'))

      expect(screen.getByTestId('annotation-layer').querySelectorAll('circle')).toHaveLength(1)
    })
  })

  describe('文字标注', () => {
    it('切换到文字模式后点击应显示输入框', async () => {
      await enterResultPage()

      // 切换到文字模式
      fireEvent.click(screen.getByTestId('tool-text'))

      const img = screen.getByAltText('截图结果')
      Object.defineProperty(img, 'getBoundingClientRect', {
        value: () => ({ left: 0, top: 0, width: 200, height: 150, right: 200, bottom: 150 }),
      })

      fireEvent.click(img, { clientX: 50, clientY: 60 })

      expect(screen.getByTestId('text-annotation-input')).toBeInTheDocument()
    })

    it('输入文字并按 Enter 应创建文字标注', async () => {
      await enterResultPage()

      fireEvent.click(screen.getByTestId('tool-text'))

      const img = screen.getByAltText('截图结果')
      Object.defineProperty(img, 'getBoundingClientRect', {
        value: () => ({ left: 0, top: 0, width: 200, height: 150, right: 200, bottom: 150 }),
      })

      fireEvent.click(img, { clientX: 50, clientY: 60 })

      const input = screen.getByTestId('text-annotation-input').querySelector('input')!
      fireEvent.keyDown(input, { key: 'Enter', target: { value: '测试标注' } })

      // 输入框消失
      expect(screen.queryByTestId('text-annotation-input')).not.toBeInTheDocument()
      // SVG 中有文字标注
      const texts = screen.getByTestId('annotation-layer').querySelectorAll('text')
      expect(texts.length).toBeGreaterThanOrEqual(1)
      expect(texts[0]).toHaveTextContent('测试标注')
    })
  })
})
