import { useEffect, useState } from 'react'
import {
  Box,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  Typography,
  CircularProgress,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { listTodos, createTodo } from '../services/todo.service'
import type { Todo, TodoPriority } from '../services/todo.service'

const PRIORITY_LABEL: Record<TodoPriority, string> = {
  0: '低',
  1: '中',
  2: '高',
}

/// 待办事项视图：加载列表 + 顶部新建
export default function TodoView() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadAll = () => {
    setLoading(true)
    setError(null)
    listTodos()
      .then(setTodos)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadAll()
  }, [])

  const handleAdd = async () => {
    const trimmed = title.trim()
    if (!trimmed) return
    try {
      const created = await createTodo({ title: trimmed })
      setTodos((prev) => [...prev, created])
      setTitle('')
    } catch (e) {
      setError(String(e))
    }
  }

  return (
    <Box data-testid="todo-view">
      <Typography variant="h5" gutterBottom>
        待办事项
      </Typography>

      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="输入待办内容，回车添加"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd()
          }}
          inputProps={{ 'data-testid': 'todo-input' }}
        />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAdd}
          data-testid="todo-add"
        >
          添加
        </Button>
      </Box>

      {error && (
        <Typography color="error" data-testid="todo-error">
          {error}
        </Typography>
      )}

      {loading ? (
        <CircularProgress data-testid="todo-loading" />
      ) : todos.length === 0 ? (
        <Typography color="text.secondary" data-testid="todo-empty">
          暂无待办，添加一个吧
        </Typography>
      ) : (
        <List data-testid="todo-list">
          {todos.map((todo) => (
            <ListItem
              key={todo.id}
              divider
              data-testid={`todo-item-${todo.id}`}
            >
              <ListItemText
                primary={todo.title}
                secondary={
                  <>
                    优先级：{PRIORITY_LABEL[todo.priority] ?? '低'}
                    {todo.dueDate ? ` · 截止 ${todo.dueDate}` : ''}
                  </>
                }
              />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  )
}