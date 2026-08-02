import { useState, useEffect } from 'react'
import { Box, Typography, Card, CardActionArea, Stack, IconButton } from '@mui/material'
import SettingsIcon from '@mui/icons-material/Settings'
import ScreenshotIcon from '@mui/icons-material/ScreenshotMonitor'
import VideocamIcon from '@mui/icons-material/Videocam'
import PushPinIcon from '@mui/icons-material/PushPin'
import ColorizeIcon from '@mui/icons-material/Colorize'
import type { FeatureEntry } from '../types/window'
import { createWindow } from '../services/window.service'
import {
  DEFAULT_SHORTCUTS,
  getShortcuts,
  getShortcutByAction,
} from '../services/shortcut.service'
import type { ShortcutConfig, ShortcutAction } from '../services/shortcut.service'
import SettingsView from './SettingsView'

const FEATURES: FeatureEntry[] = [
  { id: 'screenshot', label: '截图', icon: 'ScreenshotMonitor', windowType: 'capture', shortcut: 'Ctrl+Shift+S' },
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

/// 窗口类型 -> 快捷键动作
function windowTypeToAction(windowType: string): ShortcutAction {
  switch (windowType) {
    case 'capture':
      return 'screenshot'
    case 'recorder':
      return 'recorder'
    case 'pin':
      return 'pin'
    case 'color-picker':
      return 'color-picker'
    default:
      return 'screenshot'
  }
}

export default function MainView() {
  const [config, setConfig] = useState<ShortcutConfig>(DEFAULT_SHORTCUTS)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const loadConfig = () => {
    getShortcuts()
      .then(setConfig)
      .catch(() => {
        /* 加载失败保持默认值 */
      })
  }

  useEffect(() => {
    loadConfig()
  }, [])

  const handleFeatureClick = async (windowType: string) => {
    try {
      await createWindow(windowType)
    } catch (error) {
      console.error('创建窗口失败:', error)
    }
  }

  const handleSettingsClose = () => {
    setSettingsOpen(false)
    // 关闭设置后重新加载，让卡片快捷键提示同步更新
    loadConfig()
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        p: 3,
        gap: 3,
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Stack alignItems="flex-start" spacing={0.5}>
          <Typography variant="h5" component="h1" fontWeight="bold">
            SnapMaster
          </Typography>
          <Typography variant="body2" color="text.secondary">
            跨平台截图工具
          </Typography>
        </Stack>
        <IconButton
          onClick={() => setSettingsOpen(true)}
          data-testid="open-settings"
          aria-label="快捷键设置"
        >
          <SettingsIcon />
        </IconButton>
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
            <CardActionArea
              sx={{ p: 2, textAlign: 'center' }}
              onClick={() => handleFeatureClick(feature.windowType)}
            >
              <Stack alignItems="center" spacing={1}>
                {ICON_MAP[feature.icon]}
                <Typography variant="body1" fontWeight="medium">
                  {feature.label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {getShortcutByAction(config, windowTypeToAction(feature.windowType))}
                </Typography>
              </Stack>
            </CardActionArea>
          </Card>
        ))}
      </Box>

      <SettingsView open={settingsOpen} onClose={handleSettingsClose} />
    </Box>
  )
}
