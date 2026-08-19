import { invoke } from '@tauri-apps/api/core'

/// 待办优先级：0低 / 1中 / 2高
export type TodoPriority = number

export interface Todo {
  id: number
  title: string
  done: boolean
  priority: TodoPriority
  dueDate?: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateTodoInput {
  title: string
  priority?: TodoPriority
  dueDate?: string | null
}

/// 查询全部待办
export async function listTodos(): Promise<Todo[]> {
  return invoke<Todo[]>('list_todos')
}

/// 新建待办
export async function createTodo(input: CreateTodoInput): Promise<Todo> {
  return invoke<Todo>('create_todo', {
    title: input.title,
    priority: input.priority ?? 0,
    dueDate: input.dueDate ?? null,
  })
}

/// 切换完成状态
export async function toggleTodo(id: number): Promise<Todo | null> {
  return invoke<Todo | null>('toggle_todo', { id })
}

/// 删除待办
export async function deleteTodo(id: number): Promise<boolean> {
  return invoke<boolean>('delete_todo', { id })
}

/// 更新待办（标题必填）
export async function updateTodo(id: number, input: CreateTodoInput): Promise<Todo | null> {
  return invoke<Todo | null>('update_todo', {
    id,
    title: input.title,
    priority: input.priority ?? 0,
    dueDate: input.dueDate ?? null,
  })
}