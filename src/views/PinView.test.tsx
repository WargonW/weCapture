import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import PinView from './PinView'

// 模拟 @tauri-apps/api/window
const startDraggingMock = vi.fn()
const setSizeMock = vi.fn()
const closeMock = vi.fn()
const fakeWindow = {
  label: 'pin-test-1',
  startDragging: (...a: unknown[]) => startDraggingMock(...a),
  setSize: (...a: unknown[]) => setSizeMock(...a),
  close: (...a: unknown[]) => closeMock(...a),
}
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => fakeWindow,
  LogicalSize: class {
    constructor(public width: number, public height: number) {}
  },
}))

// 模拟 pin.service
const takePinImageMock = vi.fn()
const closePinWindowMock = vi.fn()
vi.mock('../services/pin.service', () => ({
  takePinImage: (...args: unknown[]) => takePinImageMock(...args),
  closePinWindow: (...args: unknown[]) => closePinWindowMock(...args),
}))

// 模拟 capture.service
const saveToFileMock = vi.fn()
const copyToClipboardMock = vi.fn()
vi.mock('../services/capture.service', () => ({
  saveToFile: (...args: unknown[]) => saveToFileMock(...args),
  copyToClipboard: (...args: unknown[]) => copyToClipboardMock(...args),
}))

const theme = createTheme()

const renderView = () =>
  render(
    <ThemeProvider theme={theme}>
      <PinView />
    </ThemeProvider>,
  )

const DATA_URL = 'data:image/png;base64,iVBORw0KGgo='

describe('PinView 贴图视图', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    takePinImageMock.mockResolvedValue(DATA_URL)
    closePinWindowMock.mockResolvedValue(undefined)
    copyToClipboardMock.mockResolvedValue(undefined)
    saveToFileMock.mockResolvedValue('/home/user/snapmaster_123.png')
  })

  describe('加载数据', () => {
    it('应调用 takePinImage 获取数据', async () => {
      renderView()
      await waitFor(() => {
        expect(takePinImageMock).toHaveBeenCalledWith('pin-test-1')
      })
    })

    it('加载完成后应显示图片', async () => {
      renderView()
      await waitFor(() => {
        const img = screen.getByTestId('pin-image')
        expect(img).toHaveAttribute('src', DATA_URL)
      })
    })

    it('数据为空应显示错误', async () => {
      takePinImageMock.mockResolvedValue(null)
      renderView()
      await waitFor(() => {
        expect(screen.getByTestId('pin-error')).toHaveTextContent('无贴图数据')
      })
    })
  })

  describe('拖动移动', () => {
    it('鼠标按下图片应调用 startDragging', async () => {
      renderView()
      await waitFor(() => {
        expect(screen.getByTestId('pin-image')).toBeInTheDocument()
      })
      fireEvent.mouseDown(screen.getByTestId('pin-image'), { button: 0 })
      expect(startDraggingMock).toHaveBeenCalled()
    })

    it('非左键按下不应触发拖动', async () => {
      renderView()
      await waitFor(() => {
        expect(screen.getByTestId('pin-image')).toBeInTheDocument()
      })
      fireEvent.mouseDown(screen.getByTestId('pin-image'), { button: 2 })
      expect(startDraggingMock).not.toHaveBeenCalled()
    })
  })

  describe('缩放手柄', () => {
    it('应存在右下角缩放手柄', async () => {
      renderView()
      await waitFor(() => {
        expect(screen.getByTestId('pin-resize-handle')).toBeInTheDocument()
      })
    })

    it('拖拽手柄应调用 setInnerSize', async () => {
      renderView()
      await waitFor(() => {
        expect(screen.getByTestId('pin-resize-handle')).toBeInTheDocument()
      })

      const handle = screen.getByTestId('pin-resize-handle')
      fireEvent.mouseDown(handle, { screenX: 100, screenY: 100 })
      // 模拟移动
      fireEvent.mouseMove(window, { screenX: 150, screenY: 130 })
      fireEvent.mouseUp(window)

      await waitFor(() => {
        expect(setSizeMock).toHaveBeenCalled()
      })
    })

    it('缩放不应小于最小尺寸', async () => {
      renderView()
      await waitFor(() => {
        expect(screen.getByTestId('pin-resize-handle')).toBeInTheDocument()
      })

      const handle = screen.getByTestId('pin-resize-handle')
      // 反向拖拽到极小
      fireEvent.mouseDown(handle, { screenX: 500, screenY: 500 })
      fireEvent.mouseMove(window, { screenX: 0, screenY: 0 })
      fireEvent.mouseUp(window)

      await waitFor(() => {
        expect(setSizeMock).toHaveBeenCalled()
        const sizeArg = setSizeMock.mock.calls[0][0]
        expect(sizeArg.width).toBeGreaterThanOrEqual(80)
        expect(sizeArg.height).toBeGreaterThanOrEqual(60)
      })
    })

    it('手柄按下不应触发窗口拖动', async () => {
      renderView()
      await waitFor(() => {
        expect(screen.getByTestId('pin-resize-handle')).toBeInTheDocument()
      })
      fireEvent.mouseDown(screen.getByTestId('pin-resize-handle'), { button: 0 })
      expect(startDraggingMock).not.toHaveBeenCalled()
    })
  })

  describe('关闭', () => {
    it('悬停应显示关闭按钮', async () => {
      renderView()
      await waitFor(() => {
        expect(screen.getByTestId('pin-image')).toBeInTheDocument()
      })
      fireEvent.mouseEnter(screen.getByTestId('pin-view'))
      expect(screen.getByTestId('pin-close')).toBeInTheDocument()
    })

    it('点击关闭按钮应调用 closePinWindow', async () => {
      renderView()
      await waitFor(() => {
        expect(screen.getByTestId('pin-image')).toBeInTheDocument()
      })
      fireEvent.mouseEnter(screen.getByTestId('pin-view'))
      fireEvent.click(screen.getByTestId('pin-close'))

      await waitFor(() => {
        expect(closePinWindowMock).toHaveBeenCalledWith('pin-test-1')
      })
    })

    it('按 Esc 应关闭窗口', async () => {
      renderView()
      await waitFor(() => {
        expect(screen.getByTestId('pin-image')).toBeInTheDocument()
      })
      fireEvent.keyDown(window, { key: 'Escape' })

      await waitFor(() => {
        expect(closePinWindowMock).toHaveBeenCalledWith('pin-test-1')
      })
    })

    it('按非 Esc 键不应关闭', async () => {
      renderView()
      await waitFor(() => {
        expect(screen.getByTestId('pin-image')).toBeInTheDocument()
      })
      fireEvent.keyDown(window, { key: 'Enter' })
      expect(closePinWindowMock).not.toHaveBeenCalled()
    })
  })

  describe('操作栏', () => {
    it('点击图片应显示操作栏', async () => {
      renderView()
      await waitFor(() => {
        expect(screen.getByTestId('pin-image')).toBeInTheDocument()
      })
      expect(screen.queryByTestId('pin-actions')).not.toBeInTheDocument()
      fireEvent.click(screen.getByTestId('pin-image'))
      expect(screen.getByTestId('pin-actions')).toBeInTheDocument()
    })

    it('再次点击应隐藏操作栏', async () => {
      renderView()
      await waitFor(() => {
        expect(screen.getByTestId('pin-image')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByTestId('pin-image'))
      expect(screen.getByTestId('pin-actions')).toBeInTheDocument()
      fireEvent.click(screen.getByTestId('pin-image'))
      expect(screen.queryByTestId('pin-actions')).not.toBeInTheDocument()
    })

    it('取消按钮应隐藏操作栏', async () => {
      renderView()
      await waitFor(() => {
        expect(screen.getByTestId('pin-image')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByTestId('pin-image'))
      fireEvent.click(screen.getByTestId('pin-cancel-actions'))
      expect(screen.queryByTestId('pin-actions')).not.toBeInTheDocument()
    })

    it('复制按钮应调用 copyToClipboard（传 base64）', async () => {
      renderView()
      await waitFor(() => {
        expect(screen.getByTestId('pin-image')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByTestId('pin-image'))
      fireEvent.click(screen.getByTestId('pin-copy'))

      await waitFor(() => {
        // data:image/png;base64,iVBORw0KGgo= → 去掉前缀
        expect(copyToClipboardMock).toHaveBeenCalledWith('iVBORw0KGgo=')
      })
    })

    it('保存按钮应调用 saveToFile（传 base64）', async () => {
      renderView()
      await waitFor(() => {
        expect(screen.getByTestId('pin-image')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByTestId('pin-image'))
      fireEvent.click(screen.getByTestId('pin-save'))

      await waitFor(() => {
        expect(saveToFileMock).toHaveBeenCalledWith('iVBORw0KGgo=')
      })
    })

    it('复制成功应显示提示', async () => {
      renderView()
      await waitFor(() => {
        expect(screen.getByTestId('pin-image')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByTestId('pin-image'))
      fireEvent.click(screen.getByTestId('pin-copy'))

      await waitFor(() => {
        expect(screen.getByTestId('pin-message')).toHaveTextContent('已复制')
      })
    })
  })
})
