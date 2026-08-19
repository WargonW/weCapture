import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import TodoView from './TodoView'
import type { Todo } from '../services/todo.service'

const listTodosMock = vi.fn()
const createTodoMock = vi.fn()

vi.mock('../services/todo.service', () => ({
  listTodos: (...args: unknown[]) => listTodosMock(...args),
  createTodo: (...args: unknown[]) => createTodoMock(...args),
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
    createTodoMock.mockResolvedValue({})
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
      expect(createTodoMock).toHaveBeenCalledWith({ title: '买菜' })
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
})