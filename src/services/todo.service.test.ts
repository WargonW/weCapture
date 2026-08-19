import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  listTodos,
  createTodo,
  toggleTodo,
  deleteTodo,
  updateTodo,
} from './todo.service'
import type { Todo } from './todo.service'

// 模拟 @tauri-apps/api/core 的 invoke
const invokeMock = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}))

const sampleTodo = (overrides: Partial<Todo> = {}): Todo => ({
  id: 1,
  title: '写周报',
  done: false,
  priority: 1,
  dueDate: null,
  createdAt: '1724000000',
  updatedAt: '1724000000',
  ...overrides,
})

describe('todo.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('listTodos 调用 invoke 并返回列表', async () => {
    invokeMock.mockResolvedValueOnce([sampleTodo()])
    const list = await listTodos()
    expect(invokeMock).toHaveBeenCalledWith('list_todos')
    expect(list).toHaveLength(1)
  })

  it('createTodo 传默认优先级0与null截止日期', async () => {
    invokeMock.mockResolvedValueOnce(sampleTodo())
    await createTodo({ title: '买菜' })
    expect(invokeMock).toHaveBeenCalledWith('create_todo', {
      title: '买菜',
      priority: 0,
      dueDate: null,
    })
  })

  it('toggleTodo 调用 invoke 并返回更新后的待办', async () => {
    invokeMock.mockResolvedValueOnce(sampleTodo({ done: true }))
    const todo = await toggleTodo(1)
    expect(invokeMock).toHaveBeenCalledWith('toggle_todo', { id: 1 })
    expect(todo?.done).toBe(true)
  })

  it('deleteTodo 调用 invoke 并返回删除结果', async () => {
    invokeMock.mockResolvedValueOnce(true)
    await expect(deleteTodo(2)).resolves.toBe(true)
    expect(invokeMock).toHaveBeenCalledWith('delete_todo', { id: 2 })
  })

  it('updateTodo 传标题与参数', async () => {
    invokeMock.mockResolvedValueOnce(sampleTodo({ title: '新标题' }))
    await updateTodo(1, { title: '新标题', priority: 2 })
    expect(invokeMock).toHaveBeenCalledWith('update_todo', {
      id: 1,
      title: '新标题',
      priority: 2,
      dueDate: null,
    })
  })

  it('应透传后端返回的错误', async () => {
    invokeMock.mockRejectedValueOnce('标题不能为空')
    await expect(createTodo({ title: '  ' })).rejects.toBe('标题不能为空')
  })
})