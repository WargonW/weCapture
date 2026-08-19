import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import TodoView from './TodoView'
import type { Todo } from '../services/todo.service'

const listTodosMock = vi.fn()
const createTodoMock = vi.fn()
const toggleTodoMock = vi.fn()
const deleteTodoMock = vi.fn()
const updateTodoMock = vi.fn()

vi.mock('../services/todo.service', () => ({
  listTodos: (...args: unknown[]) => listTodosMock(...args),
  createTodo: (...args: unknown[]) => createTodoMock(...args),
  toggleTodo: (...args: unknown[]) => toggleTodoMock(...args),
  deleteTodo: (...args: unknown[]) => deleteTodoMock(...args),
  updateTodo: (...args: unknown[]) => updateTodoMock(...args),
}))

const theme = createTheme()

const renderView = () =>
  render(
    <ThemeProvider theme={theme}>
      <TodoView />
    </ThemeProvider>,
  )

const sampleTodo = (overrides: Partial<Todo> = {}): Todo => ({
  id: 1,
  title: '写周报',
  done: false,
  priority: 1,
  dueDate: null,
  createdAt: '1789600000',
  updatedAt: '1789600000',
  ...overrides,
})

describe('TodoView 待办视图', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listTodosMock.mockResolvedValue([])
    createTodoMock.mockResolvedValue(sampleTodo({ id: 99 }))
    toggleTodoMock.mockResolvedValue(sampleTodo({ done: true }))
    deleteTodoMock.mockResolvedValue(true)
    updateTodoMock.mockResolvedValue(sampleTodo({ id: 1 }))
  })

  it('挂载后加载待办列表', async () => {
    listTodosMock.mockResolvedValue([sampleTodo()])
    renderView()
    await waitFor(() => {
      expect(screen.getByTestId('todo-item-1')).toBeInTheDocument()
    })
    expect(screen.getByText('写周报')).toBeInTheDocument()
  })

  it('列表为空时显示空状态', async () => {
    renderView()
    await waitFor(() => {
      expect(screen.getByTestId('todo-empty')).toBeInTheDocument()
    })
  })

  it('新建待办后追加到列表并清空输入', async () => {
    listTodosMock.mockResolvedValue([])
    createTodoMock.mockResolvedValue(sampleTodo({ id: 2, title: '买菜' }))
    renderView()
    await waitFor(() => {
      expect(screen.getByTestId('todo-empty')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByTestId('todo-input'), { target: { value: '买菜' } })
    fireEvent.click(screen.getByTestId('todo-add'))

    await waitFor(() => {
      expect(createTodoMock).toHaveBeenCalledWith({
        title: '买菜',
        priority: 0,
        dueDate: null,
      })
      expect(screen.getByTestId('todo-item-2')).toBeInTheDocument()
    })
    expect((screen.getByTestId('todo-input') as HTMLInputElement).value).toBe('')
  })

  it('空标题不触发新建', async () => {
    renderView()
    await waitFor(() => {
      expect(screen.getByTestId('todo-input')).toBeInTheDocument()
    })
    fireEvent.change(screen.getByTestId('todo-input'), { target: { value: '   ' } })
    fireEvent.click(screen.getByTestId('todo-add'))
    await new Promise((r) => setTimeout(r, 20))
    expect(createTodoMock).not.toHaveBeenCalled()
  })

  it('加载失败显示错误', async () => {
    listTodosMock.mockRejectedValue(new Error('db fail'))
    renderView()
    await waitFor(() => {
      expect(screen.getByTestId('todo-error')).toBeInTheDocument()
    })
  })

  it('勾选待办切换完成状态并回填', async () => {
    listTodosMock.mockResolvedValue([sampleTodo({ id: 1, done: false })])
    renderView()
    await waitFor(() => {
      expect(screen.getByTestId('todo-item-1')).toBeInTheDocument()
    })

    const toggleInput = screen.getByTestId('todo-toggle-1').querySelector('input')!
    fireEvent.click(toggleInput)

    await waitFor(() => {
      expect(toggleTodoMock).toHaveBeenCalledWith(1)
    })
    await waitFor(() => {
      expect(toggleInput.checked).toBe(true)
    })
  })

  it('点击删除按钮移除待办', async () => {
    listTodosMock.mockResolvedValue([sampleTodo({ id: 1 }), sampleTodo({ id: 2, title: '买菜' })])
    renderView()
    await waitFor(() => {
      expect(screen.getByTestId('todo-item-1')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('todo-delete-1'))

    await waitFor(() => {
      expect(deleteTodoMock).toHaveBeenCalledWith(1)
      expect(screen.queryByTestId('todo-item-1')).not.toBeInTheDocument()
      expect(screen.getByTestId('todo-item-2')).toBeInTheDocument()
    })
  })

  it('已完成 Tab 只显示已完成事项', async () => {
    listTodosMock.mockResolvedValue([
      sampleTodo({ id: 1, done: false, title: '进行中' }),
      sampleTodo({ id: 2, done: true, title: '已完成' }),
    ])
    renderView()
    await waitFor(() => {
      expect(screen.getByTestId('todo-item-1')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('filter-tab-done'))

    await waitFor(() => {
      expect(screen.queryByTestId('todo-item-1')).not.toBeInTheDocument()
      expect(screen.getByTestId('todo-item-2')).toBeInTheDocument()
    })
  })

  it('选择高优先级后新建传 priority=2', async () => {
    listTodosMock.mockResolvedValue([])
    renderView()
    await waitFor(() => {
      expect(screen.getByTestId('todo-input')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('priority-2'))
    fireEvent.change(screen.getByTestId('todo-input'), { target: { value: '重要任务' } })
    fireEvent.click(screen.getByTestId('todo-add'))

    await waitFor(() => {
      expect(createTodoMock).toHaveBeenCalledWith({
        title: '重要任务',
        priority: 2,
        dueDate: null,
      })
    })
  })

  it('新建时带截止日期传给 createTodo 与 dueDate', async () => {
    listTodosMock.mockResolvedValue([])
    renderView()
    await waitFor(() => {
      expect(screen.getByTestId('todo-input')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByTestId('todo-input'), { target: { value: '面试' } })
    fireEvent.change(screen.getByTestId('todo-due'), { target: { value: '2026-09-01' } })
    fireEvent.click(screen.getByTestId('todo-add'))

    await waitFor(() => {
      expect(createTodoMock).toHaveBeenCalledWith({
        title: '面试',
        priority: 0,
        dueDate: '2026-09-01',
      })
    })
  })

  it('打开编辑弹窗并回填当前值，保存后调用 updateTodo 更新列表', async () => {
    listTodosMock.mockResolvedValue([sampleTodo({ id: 1, title: '旧标题' })])
    updateTodoMock.mockResolvedValue(sampleTodo({ id: 1, title: '新标题', priority: 2 }))
    renderView()
    await waitFor(() => {
      expect(screen.getByTestId('todo-item-1')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('todo-edit-1'))
    await waitFor(() => {
      expect(screen.getByTestId('todo-edit-dialog')).toBeInTheDocument()
    })
    expect((screen.getByTestId('todo-edit-title') as HTMLInputElement).value).toBe('旧标题')

    fireEvent.change(screen.getByTestId('todo-edit-title'), { target: { value: '新标题' } })
    fireEvent.click(screen.getByTestId('edit-priority-2'))
    fireEvent.click(screen.getByTestId('todo-edit-save'))

    await waitFor(() => {
      expect(updateTodoMock).toHaveBeenCalledWith(1, {
        title: '新标题',
        priority: 2,
        dueDate: null,
      })
    })
    await waitFor(() => {
      expect(screen.getByText('新标题')).toBeInTheDocument()
    })
  })
})