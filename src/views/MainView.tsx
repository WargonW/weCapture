import { Box, Typography, Card, CardActionArea, Stack } from '@mui/material'
import ScreenshotIcon from '@mui/icons-material/ScreenshotMonitor'
import VideocamIcon from '@mui/icons-material/Videocam'
import PushPinIcon from '@mui/icons-material/PushPin'
import ColorizeIcon from '@mui/icons-material/Colorize'
import type { FeatureEntry } from '../types/window'

const FEATURES: FeatureEntry[] = [
  { id: 'screenshot', label: '截图', icon: 'ScreenshotMonitor', windowType: 'capture', shortcut: 'Ctrl+Shift+A' },
  { id: 'recorder', label: '录屏', icon: 'Videocam', windowType: 'recorder', shortcut: 'Ctrl+Shift+R' },
  { id: 'pin', label: '贴图', icon: 'PushPin', windowType: 'pin', shortcut: 'Ctrl+Shift+P' },
  { id: 'color-picker', label: '取色', icon: 'Colorize', windowType: 'color-picker', shortcut: 'Ctrl+Shift+C' },
]

const ICON_MAP: Record<string, React.ReactElement> = {
  ScreenshotMonitor: <ScreenshotIcon sx={{ fontSize: 40, color: 'primary.main' }} />,
  Videocam: <VideocamIcon sx={{ fontSize: 40, color: 'primary.main' }} />,
  PushPin: <PushPinIcon sx={{ fontSize: 40, color: 'primary.main' }} />,
  Colorize: <ColorizeIcon sx={{ fontSize: 40, color: 'primary.main' }} />,
}

export default function MainView() {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        p: 3,
        gap: 3,
      }}
    >
      <Stack alignItems="center" spacing={0.5}>
        <Typography variant="h5" component="h1" fontWeight="bold">
          SnapMaster
        </Typography>
        <Typography variant="body2" color="text.secondary">
          跨平台截图工具
        </Typography>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 2,
          width: '100%',
        }}
      >
        {FEATURES.map((feature) => (
          <Card key={feature.id} elevation={2}>
            <CardActionArea sx={{ p: 2, textAlign: 'center' }}>
              <Stack alignItems="center" spacing={1}>
                {ICON_MAP[feature.icon]}
                <Typography variant="body1" fontWeight="medium">
                  {feature.label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {feature.shortcut}
                </Typography>
              </Stack>
            </CardActionArea>
          </Card>
        ))}
      </Box>
    </Box>
  )
}
