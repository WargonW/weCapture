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
  Checkbox,
  IconButton,
  Tabs,
  Tab,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import { listTodos, createTodo, toggleTodo, deleteTodo } from '../services/todo.service'
import type { Todo, TodoPriority } from '../services/todo.service'

const PRIORITY_LABEL: Record<TodoPriority, string> = {
  0: '低',
  1: '中',
  2: '高',
}

const PRIORITY_OPTIONS: { value: TodoPriority; label: string }[] = [
  { value: 0, label: '低' },
  { value: 1, label: '中' },
  { value: 2, label: '高' },
]

type Filter = 'all' | 'active' | 'done'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'active', label: '进行中' },
  { value: 'done', label: '已完成' },
]

/// 待办事项视图：加载列表 + 筛选 + 新建 + 勾选/删除
export default function TodoView() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<TodoPriority>(0)
  const [filter, setFilter] = useState<Filter>('all')
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
      const created = await createTodo({ title: trimmed, priority })
      setTodos((prev) => [...prev, created])
      setTitle('')
    } catch (e) {
      setError(String(e))
    }
  }

  const handleToggle = async (id: number) => {
    try {
      const updated = await toggleTodo(id)
      if (updated) {
        setTodos((prev) => prev.map((t) => (t.id === id ? updated : t)))
      }
    } catch (e) {
      setError(String(e))
    }
  }

  const handleDelete = async (id: number) => {
    try {
      const ok = await deleteTodo(id)
      if (ok) {
        setTodos((prev) => prev.filter((t) => t.id !== id))
      }
    } catch (e) {
      setError(String(e))
    }
  }

  const filtered =
    filter === 'all'
      ? todos
      : filter === 'active'
        ? todos.filter((t) => !t.done)
        : todos.filter((t) => t.done)

  return (
    <Box data-testid="todo-view">
      <Typography variant="h5" gutterBottom>
        待办事项
      </Typography>

      <Tabs
        value={filter}
        onChange={(_, v: Filter) => setFilter(v)}
        data-testid="todo-filter"
      >
        {FILTERS.map((f) => (
          <Tab
            key={f.value}
            label={f.label}
            value={f.value}
            data-testid={`filter-tab-${f.value}`}
          />
        ))}
      </Tabs>

      <Box sx={{ display: 'flex', gap: 1, my: 2, alignItems: 'center' }}>
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
        <ToggleButtonGroup
          size="small"
          exclusive
          value={priority}
          onChange={(_, v: TodoPriority | null) => v !== null && setPriority(v)}
          data-testid="todo-priority"
        >
          {PRIORITY_OPTIONS.map((o) => (
            <ToggleButton key={o.value} value={o.value} data-testid={`priority-${o.value}`}>
              {o.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
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
      ) : filtered.length === 0 ? (
        <Typography color="text.secondary" data-testid="todo-empty">
          {filter === 'all' ? '暂无待办，添加一个吧' : '当前筛选下没有待办'}
        </Typography>
      ) : (
        <List data-testid="todo-list">
          {filtered.map((todo) => (
            <ListItem
              key={todo.id}
              divider
              secondaryAction={
                <IconButton
                  edge="end"
                  aria-label="删除"
                  onClick={() => handleDelete(todo.id)}
                  data-testid={`todo-delete-${todo.id}`}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              }
              data-testid={`todo-item-${todo.id}`}
            >
              <Checkbox
                edge="start"
                checked={todo.done}
                onChange={() => handleToggle(todo.id)}
                data-testid={`todo-toggle-${todo.id}`}
              />
              <ListItemText
                primary={
                  <span
                    style={todo.done ? { textDecoration: 'line-through', opacity: 0.6 } : undefined}
                  >
                    {todo.title}
                  </span>
                }
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