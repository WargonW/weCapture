import { Box, Typography } from '@mui/material'

/// 待办事项视图（T2 阶段实现完整逻辑，当前为占位）
export default function TodoView() {
  return (
    <Box data-testid="todo-view">
      <Typography variant="h5" gutterBottom>
        待办事项
      </Typography>
      <Typography color="text.secondary">功能开发中（T2 实现）</Typography>
    </Box>
  )
}