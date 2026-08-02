import { Box, Typography, IconButton } from '@mui/material'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import StopIcon from '@mui/icons-material/Stop'
import PauseIcon from '@mui/icons-material/Pause'

/// 录屏控制条视图：悬浮工具条
export default function RecorderView() {
  return (
    <Box
      data-testid="recorder-control"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        p: 1,
        borderRadius: 3,
        bgcolor: 'background.paper',
        boxShadow: 3,
      }}
    >
      <IconButton size="small" color="error">
        <FiberManualRecordIcon />
      </IconButton>
      <IconButton size="small">
        <PauseIcon />
      </IconButton>
      <IconButton size="small">
        <StopIcon />
      </IconButton>
      <Typography variant="body2" sx={{ ml: 1 }}>
        00:00
      </Typography>
    </Box>
  )
}
