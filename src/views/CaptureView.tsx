import { useState, useCallback } from 'react'
import { Box, IconButton, Stack, CircularProgress, Typography } from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import SaveAltIcon from '@mui/icons-material/SaveAlt'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { captureRegion } from '../services/capture.service'
import { saveToFile, copyToClipboard } from '../services/capture.service'
import type { CaptureRegion, ScreenshotResult } from '../types/capture'
import { toDataUrl } from '../types/capture'

/// 选区状态
interface SelectionRect {
  x: number
  y: number
  width: number
  height: number
}

/// 截图浮层视图：全屏覆盖，拖拽选区，确认截图
export default function CaptureView() {
  // 拖拽起点
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  // 当前选区
  const [selection, setSelection] = useState<SelectionRect | null>(null)
  // 是否正在拖拽
  const [isDragging, setIsDragging] = useState(false)
  // 截图结果
  const [result, setResult] = useState<ScreenshotResult | null>(null)
  // 截图加载中
  const [loading, setLoading] = useState(false)
  // 截图错误
  const [error, setError] = useState<string | null>(null)
  // 保存/复制状态
  const [saving, setSaving] = useState(false)
  const [copying, setCopying] = useState(false)
  // 提示消息
  const [message, setMessage] = useState<string | null>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (result || loading) return
    const x = e.clientX
    const y = e.clientY
    setDragStart({ x, y })
    setIsDragging(true)
    // 清除上次选区和结果
    setSelection(null)
    setResult(null)
    setError(null)
  }, [result, loading])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !dragStart) return
    const x2 = e.clientX
    const y2 = e.clientY
    const x = Math.min(dragStart.x, x2)
    const y = Math.min(dragStart.y, y2)
    const width = Math.abs(x2 - dragStart.x)
    const height = Math.abs(y2 - dragStart.y)
    setSelection({ x, y, width, height })
  }, [isDragging, dragStart])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleConfirm = useCallback(async () => {
    if (!selection) return
    setLoading(true)
    setError(null)
    try {
      const region: CaptureRegion = {
        x: selection.x,
        y: selection.y,
        width: selection.width,
        height: selection.height,
      }
      const res = await captureRegion(region)
      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [selection])

  const handleCancel = useCallback(() => {
    setSelection(null)
    setDragStart(null)
    setResult(null)
    setError(null)
  }, [])

  const handleSave = useCallback(async () => {
    if (!result) return
    setSaving(true)
    try {
      const path = await saveToFile(result.imageData)
      setMessage(`已保存到: ${path}`)
      setTimeout(() => setMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }, [result])

  const handleCopy = useCallback(async () => {
    if (!result) return
    setCopying(true)
    try {
      await copyToClipboard(result.imageData)
      setMessage('已复制到剪贴板')
      setTimeout(() => setMessage(null), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setCopying(false)
    }
  }, [result])

  // 截图结果展示
  if (result) {
    return (
      <Box
        data-testid="capture-result"
        sx={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'rgba(0, 0, 0, 0.85)',
          gap: 2,
        }}
      >
        <Box
          component="img"
          src={toDataUrl(result)}
          alt="截图结果"
          sx={{
            maxWidth: '90%',
            maxHeight: '80%',
            border: '2px solid',
            borderColor: 'primary.main',
            borderRadius: 1,
          }}
        />
        <Stack direction="row" spacing={2}>
          <IconButton
            data-testid="save-to-file"
            color="primary"
            onClick={handleSave}
            disabled={saving}
            sx={{ bgcolor: 'background.paper' }}
          >
            {saving ? <CircularProgress size={20} /> : <SaveAltIcon />}
          </IconButton>
          <IconButton
            data-testid="copy-to-clipboard"
            color="primary"
            onClick={handleCopy}
            disabled={copying}
            sx={{ bgcolor: 'background.paper' }}
          >
            {copying ? <CircularProgress size={20} /> : <ContentCopyIcon />}
          </IconButton>
          <IconButton
            color="default"
            onClick={handleCancel}
            sx={{ bgcolor: 'background.paper' }}
          >
            <CloseIcon />
          </IconButton>
        </Stack>
        {/* 提示消息 */}
        {message && (
          <Typography
            data-testid="capture-message"
            sx={{
              bgcolor: 'success.main',
              color: 'success.contrastText',
              px: 2,
              py: 1,
              borderRadius: 1,
            }}
          >
            {message}
          </Typography>
        )}
      </Box>
    )
  }

  return (
    <Box
      data-testid="capture-overlay"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      sx={{
        position: 'fixed',
        inset: 0,
        bgcolor: 'rgba(0, 0, 0, 0.3)',
        cursor: 'crosshair',
        userSelect: 'none',
      }}
    >
      {/* 选区框 */}
      {selection && selection.width > 0 && selection.height > 0 && (
        <Box
          data-testid="selection-box"
          sx={{
            position: 'absolute',
            left: selection.x,
            top: selection.y,
            width: selection.width,
            height: selection.height,
            border: '2px solid',
            borderColor: 'primary.main',
            bgcolor: 'rgba(25, 118, 210, 0.1)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* 操作栏：拖拽结束后显示 */}
      {selection && !isDragging && selection.width > 0 && selection.height > 0 && (
        <Box
          data-testid="capture-toolbar"
          sx={{
            position: 'absolute',
            left: selection.x + selection.width,
            top: selection.y + selection.height + 8,
            display: 'flex',
            gap: 1,
            bgcolor: 'background.paper',
            borderRadius: 1,
            p: 0.5,
            boxShadow: 3,
          }}
        >
          <IconButton
            data-testid="confirm-capture"
            size="small"
            color="primary"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} /> : <CheckIcon />}
          </IconButton>
          <IconButton
            data-testid="cancel-capture"
            size="small"
            color="error"
            onClick={handleCancel}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      )}

      {/* 错误提示 */}
      {error && (
        <Box
          sx={{
            position: 'fixed',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            bgcolor: 'error.main',
            color: 'error.contrastText',
            px: 2,
            py: 1,
            borderRadius: 1,
          }}
        >
          {error}
        </Box>
      )}
    </Box>
  )
}
