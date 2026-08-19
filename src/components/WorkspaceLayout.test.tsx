import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import WorkspaceLayout from './WorkspaceLayout'
import type { Module } from '../modules'

const theme = createTheme()

const dataModule: Module = {
  id: 'todo',
  label: '待办',
  type: 'data',
  icon: () => <span data-testid="icon-todo" />,
  view: () => <div data-testid="todo-content">待办内容</div>,
}

const iconStub = (testId: string) =>
  function Icon() {
    return <span data-testid={testId} />
  }

const toolModules: Module[] = [
  {
    id: 'screenshot',
    label: '截图',
    type: 'tool',
    icon: iconStub('icon-screenshot'),
    windowType: 'capture',
    shortcutAction: 'screenshot',
  },
  {
    id: 'recorder',
    label: '录屏',
    type: 'tool',
    icon: iconStub('icon-recorder'),
    windowType: 'recorder',
    shortcutAction: 'recorder',
  },
]

const onSelectModule = vi.fn()
const onOpenTool = vi.fn()
const onOpenSettings = vi.fn()
const shortcutOf = (m: Module) => (m.shortcutAction ? 'Ctrl+Shift+X' : '')

const renderLayout = (props: Partial<Parameters<typeof WorkspaceLayout>[0]> = {}) =>
  render(
    <ThemeProvider theme={theme}>
      <WorkspaceLayout
        dataModules={[dataModule]}
        toolModules={toolModules}
        activeModuleId="todo"
        shortcutOf={shortcutOf}
        onSelectModule={onSelectModule}
        onOpenTool={onOpenTool}
        onOpenSettings={onOpenSettings}
        {...props}
      />
    </ThemeProvider>,
  )

describe('WorkspaceLayout 工作台布局', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('渲染标题、数据型与工具型模块', () => {
    renderLayout()
    expect(screen.getByText('SnapMaster')).toBeInTheDocument()
    expect(screen.getByText('待办')).toBeInTheDocument()
    expect(screen.getByText('截图')).toBeInTheDocument()
    expect(screen.getByText('录屏')).toBeInTheDocument()
  })

  it('内容区渲染选中的数据型模块视图', () => {
    renderLayout()
    expect(screen.getByTestId('todo-content')).toBeInTheDocument()
  })

  it('点击数据型模块触发 onSelectModule', () => {
    renderLayout()
    fireEvent.click(screen.getByTestId('module-item-todo'))
    expect(onSelectModule).toHaveBeenCalledWith('todo')
  })

  it('点击工具型模块触发 onOpenTool 并传入窗口类型', () => {
    renderLayout()
    fireEvent.click(screen.getByTestId('tool-item-screenshot'))
    expect(onOpenTool).toHaveBeenCalledWith('capture')
    fireEvent.click(screen.getByTestId('tool-item-recorder'))
    expect(onOpenTool).toHaveBeenCalledWith('recorder')
  })

  it('工具型模块显示快捷键提示', () => {
    renderLayout()
    expect(screen.getAllByText('Ctrl+Shift+X').length).toBe(2)
  })

  it('点击设置入口触发 onOpenSettings', () => {
    renderLayout()
    fireEvent.click(screen.getByTestId('open-settings'))
    expect(onOpenSettings).toHaveBeenCalled()
  })
})