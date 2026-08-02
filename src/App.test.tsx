import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { MemoryRouter } from 'react-router-dom'
import App from './App'

// 模拟 @tauri-apps/api，测试环境不需要真实调用
vi.mock('@tauri-apps/api', () => ({
  window: {
    getCurrentWindow: () => ({
      label: 'main',
    }),
  },
}))

// 模拟 @tauri-apps/api/window（PinView 依赖）
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    label: 'pin-app-test',
    startDragging: vi.fn(),
    setInnerSize: vi.fn(),
    close: vi.fn(),
  }),
  LogicalSize: class {
    constructor(public width: number, public height: number) {}
  },
}))

// 模拟 pin.service（PinView 启动时会调用 takePinImage）
vi.mock('./services/pin.service', () => ({
  takePinImage: vi.fn().mockResolvedValue('data:image/png;base64,AAA'),
  closePinWindow: vi.fn().mockResolvedValue(undefined),
}))

// 模拟 color.service（ColorPickerView 依赖）
vi.mock('./services/color.service', () => ({
  capturePixel: vi.fn().mockResolvedValue({ r: 0, g: 0, b: 0 }),
  toHex: () => '#000000',
  toRgbString: () => 'rgb(0,0,0)',
  copyText: vi.fn().mockResolvedValue(undefined),
}))

// 模拟 window.service（ColorPickerView 关闭窗口依赖）
vi.mock('./services/window.service', () => ({
  createWindow: vi.fn().mockResolvedValue('mock-window'),
  closeWindow: vi.fn().mockResolvedValue(undefined),
}))

const theme = createTheme()

const renderApp = (initialPath: string = '/') =>
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={[initialPath]}>
        <App />
      </MemoryRouter>
    </ThemeProvider>,
  )

describe('App 多窗口路由', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('主窗口 (?window=main)', () => {
    it('应该显示应用标题 SnapMaster', () => {
      renderApp('/?window=main')
      expect(screen.getByText('SnapMaster')).toBeInTheDocument()
    })

    it('应该显示截图功能入口', () => {
      renderApp('/?window=main')
      expect(screen.getByText('截图')).toBeInTheDocument()
    })

    it('应该显示录屏功能入口', () => {
      renderApp('/?window=main')
      expect(screen.getByText('录屏')).toBeInTheDocument()
    })

    it('应该显示贴图功能入口', () => {
      renderApp('/?window=main')
      expect(screen.getByText('贴图')).toBeInTheDocument()
    })

    it('应该显示取色功能入口', () => {
      renderApp('/?window=main')
      expect(screen.getByText('取色')).toBeInTheDocument()
    })
  })

  describe('截图浮层 (?window=capture)', () => {
    it('应该渲染截图浮层容器', () => {
      renderApp('/?window=capture')
      const overlay = screen.getByTestId('capture-overlay')
      expect(overlay).toBeInTheDocument()
    })
  })

  describe('录屏控制条 (?window=recorder)', () => {
    it('应该渲染录屏控制条', () => {
      renderApp('/?window=recorder')
      const control = screen.getByTestId('recorder-control')
      expect(control).toBeInTheDocument()
    })
  })

  describe('取色器 (?window=color-picker)', () => {
    it('应该渲染取色器', () => {
      renderApp('/?window=color-picker')
      const picker = screen.getByTestId('color-picker')
      expect(picker).toBeInTheDocument()
    })
  })

  describe('贴图窗口 (?window=pin)', () => {
    it('应该渲染贴图视图', async () => {
      renderApp('/?window=pin')
      await waitFor(() => {
        expect(screen.getByTestId('pin-view')).toBeInTheDocument()
      })
    })
  })
})
