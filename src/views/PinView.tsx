import { useState, useEffect, useCallback, useRef } from 'react'
import { Box, IconButton, Stack, CircularProgress, Typography } from '@mui/material'
import { LogicalSize, getCurrentWindow } from '@tauri-apps/api/window'
import CloseIcon from '@mui/icons-material/Close'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import SaveAltIcon from '@mui/icons-material/SaveAlt'
import { takePinImage, closePinWindow } from '../services/pin.service'
import { saveToFile, copyToClipboard } from '../services/capture.service'

/// 最小窗口尺寸
const MIN_W = 80
const MIN_H = 60

/// 从 data URL 提取 base64 部分
function extractBase64(dataUrl: string): string {
  const idx = dataUrl.indexOf(',')
  return idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl
}

export default function PinView() {
  const win = getCurrentWindow()
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hovered, setHovered] = useState(false)
  const [showActions, setShowActions] = useState(false)
  const [size, setSize] = useState({ w: 400, h: 300 })
  const [message, setMessage] = useState<string | null>(null)
  const resizing = useRef(false)

  /// 加载贴图数据
  useEffect(() => {
    let cancelled = false
    takePinImage(win.label)
      .then((d) => {
        if (cancelled) return
        if (d) setDataUrl(d)
        else setError('无贴图数据')
      })
      .catch((e) => !cancelled && setError(String(e)))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [win.label])

  /// 关闭
  const handleClose = useCallback(async () => {
    try {
      await closePinWindow(win.label)
    } catch (e) {
      setError(String(e))
    }
  }, [win.label])

  /// Esc 关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleClose])

  /// 拖动窗口
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return
      // 拖动时不显示操作栏
      setShowActions(false)
      win.startDragging()
    },
    [win],
  )

  /// 缩放手柄拖拽
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      resizing.current = true
      const startX = e.screenX
      const startY = e.screenY
      const startW = size.w
      const startH = size.h

      const onMove = (ev: MouseEvent) => {
        if (!resizing.current) return
        const newW = Math.max(MIN_W, Math.round(startW + ev.screenX - startX))
        const newH = Math.max(MIN_H, Math.round(startH + ev.screenY - startY))
        setSize({ w: newW, h: newH })
        win.setSize(new LogicalSize(newW, newH))
      }
      const onUp = () => {
        resizing.current = false
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [win, size],
  )

  /// 点击图片显示操作栏
  const handleImageClick = useCallback(() => {
    setShowActions((v) => !v)
  }, [])

  const handleCopy = useCallback(async () => {
    if (!dataUrl) return
    try {
      await copyToClipboard(extractBase64(dataUrl))
      setMessage('已复制')
      setTimeout(() => setMessage(null), 1500)
    } catch (e) {
      setError(String(e))
    }
  }, [dataUrl])

  const handleSave = useCallback(async () => {
    if (!dataUrl) return
    try {
      const path = await saveToFile(extractBase64(dataUrl))
      setMessage(`已保存: ${path}`)
      setTimeout(() => setMessage(null), 2000)
    } catch (e) {
      setError(String(e))
    }
  }, [dataUrl])

  if (loading) {
    return (
      <Box
        data-testid="pin-loading"
        sx={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.paper',
        }}
      >
        <CircularProgress size={24} />
      </Box>
    )
  }

  if (error) {
    return (
      <Box
        data-testid="pin-error"
        sx={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.paper',
        }}
      >
        <Typography color="error" variant="caption">
          {error}
        </Typography>
      </Box>
    )
  }

  return (
    <Box
      data-testid="pin-view"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false)
        setShowActions(false)
      }}
      sx={{
        width: '100vw',
        height: '100vh',
        position: 'relative',
        bgcolor: 'background.paper',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* 图片：可拖动 + 点击显示操作栏 */}
      <Box
        component="img"
        src={dataUrl ?? undefined}
        alt="贴图"
        data-testid="pin-image"
        onMouseDown={handleDragStart}
        onClick={handleImageClick}
        sx={{
          display: 'block',
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          cursor: 'move',
        }}
      />

      {/* 悬停关闭按钮 */}
      {hovered && (
        <IconButton
          data-testid="pin-close"
          size="small"
          onClick={handleClose}
          sx={{
            position: 'absolute',
            top: 4,
            right: 4,
            bgcolor: 'rgba(0,0,0,0.5)',
            color: 'common.white',
            '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      )}

      {/* 右下角缩放手柄 */}
      <Box
        data-testid="pin-resize-handle"
        onMouseDown={handleResizeStart}
        sx={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: 16,
          height: 16,
          cursor: 'nwse-resize',
          bgcolor: hovered ? 'rgba(25,118,210,0.6)' : 'transparent',
        }}
      />

      {/* 点击图片显示的操作栏 */}
      {showActions && (
        <Stack
          data-testid="pin-actions"
          direction="row"
          spacing={1}
          sx={{
            position: 'absolute',
            bottom: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            bgcolor: 'background.paper',
            borderRadius: 2,
            p: 0.5,
            boxShadow: 3,
          }}
        >
          <IconButton data-testid="pin-copy" size="small" color="primary" onClick={handleCopy}>
            <ContentCopyIcon fontSize="small" />
          </IconButton>
          <IconButton data-testid="pin-save" size="small" color="primary" onClick={handleSave}>
            <SaveAltIcon fontSize="small" />
          </IconButton>
          <IconButton
            data-testid="pin-cancel-actions"
            size="small"
            onClick={() => setShowActions(false)}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      )}

      {/* 提示消息 */}
      {message && (
        <Typography
          data-testid="pin-message"
          sx={{
            position: 'absolute',
            top: 4,
            left: '50%',
            transform: 'translateX(-50%)',
            bgcolor: 'success.main',
            color: 'success.contrastText',
            px: 1,
            py: 0.25,
            borderRadius: 1,
            fontSize: 12,
          }}
        >
          {message}
        </Typography>
      )}
    </Box>
  )
}
