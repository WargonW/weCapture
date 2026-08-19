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