import { Box } from '@mui/material'

/// 截图浮层视图：全屏覆盖，用于拖拽选区
export default function CaptureView() {
  return (
    <Box
      data-testid="capture-overlay"
      sx={{
        position: 'fixed',
        inset: 0,
        bgcolor: 'rgba(0, 0, 0, 0.3)',
        cursor: 'crosshair',
      }}
    />
  )
}
