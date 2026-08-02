import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  IconButton,
  Stack,
  CircularProgress,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import HotkeyRecorder from '../components/HotkeyRecorder'
import {
  getShortcuts,
  updateShortcut,
  DEFAULT_SHORTCUTS,
} from '../services/shortcut.service'
import type { ShortcutConfig, ShortcutAction } from '../services/shortcut.service'

/// 功能项：动作 + 中文标签
const FEATURE_LABELS: { action: ShortcutAction; label: string }[] = [
  { action: 'screenshot', label: '截图' },
  { action: 'recorder', label: '录屏' },
  { action: 'pin', label: '贴图' },
  { action: 'color-picker', label: '取色' },
]

export interface SettingsViewProps {
  open: boolean
  onClose: () => void
}

export default function SettingsView({ open, onClose }: SettingsViewProps) {
  const [config, setConfig] = useState<ShortcutConfig>(DEFAULT_SHORTCUTS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)
    getShortcuts()
      .then((c) => setConfig(c))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [open])

  const handleCapture = async (action: ShortcutAction, newShortcut: string) => {
    try {
      await updateShortcut(action, newShortcut)
      setConfig((prev) => ({ ...prev, [action]: newShortcut }))
      setError(null)
    } catch (e) {
      setError(String(e))
    }
  }

  return (
    <Dialog open={open} onClose={onClose} data-testid="settings-dialog">
      <DialogTitle>
        快捷键设置
        <IconButton
          onClick={onClose}
          data-testid="close-settings"
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <CircularProgress data-testid="settings-loading" />
        ) : (
          <Stack spacing={2} sx={{ minWidth: 280 }} data-testid="settings-list">
            {FEATURE_LABELS.map(({ action, label }) => (
              <Box
                key={action}
                data-testid={`shortcut-row-${action}`}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Typography>{label}</Typography>
                <HotkeyRecorder
                  value={config[action]}
                  onCapture={(sc) => handleCapture(action, sc)}
                />
              </Box>
            ))}
            {error && (
              <Typography color="error" data-testid="settings-error">
                {error}
              </Typography>
            )}
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  )
}
