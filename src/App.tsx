import { Box, Typography, Button, Stack } from '@mui/material'
import ScreenshotIcon from '@mui/icons-material/ScreenshotMonitor'

function App() {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: 3,
      }}
    >
      <Stack alignItems="center" spacing={1}>
        <ScreenshotIcon sx={{ fontSize: 64, color: 'primary.main' }} />
        <Typography variant="h4" component="h1" fontWeight="bold">
          SnapMaster
        </Typography>
        <Typography variant="body2" color="text.secondary">
          跨平台截图工具
        </Typography>
      </Stack>
      <Button variant="contained" color="primary" size="large">
        开始截图
      </Button>
    </Box>
  )
}

export default App
