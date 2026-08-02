import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Box,
  IconButton,
  Stack,
  CircularProgress,
  Typography,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Button,
  MenuItem,
  Select,
  FormControl,
} from '@mui/material'
import type { SelectChangeEvent } from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import SaveAltIcon from '@mui/icons-material/SaveAlt'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import PushPinIcon from '@mui/icons-material/PushPin'
import UndoIcon from '@mui/icons-material/Undo'
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep'
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered'
import TextFieldsIcon from '@mui/icons-material/TextFields'
import FullscreenIcon from '@mui/icons-material/Fullscreen'
import MonitorIcon from '@mui/icons-material/Monitor'
import { captureRegion, captureFullscreen, listMonitors } from '../services/capture.service'
import { saveToFile, copyToClipboard } from '../services/capture.service'
import { pinImage } from '../services/pin.service'
import type { CaptureRegion, MonitorInfo, ScreenshotResult } from '../types/capture'
import { toDataUrl } from '../types/capture'
import { useAnnotations } from '../hooks/useAnnotations'
import { composeImage } from '../utils/composeImage'

/// 选区状态
interface SelectionRect {
  x: number
  y: number
  width: number
  height: number
}

/// 数字标注圆圈半径
const CIRCLE_RADIUS = 20

/// 截图浮层视图：全屏覆盖，拖拽选区，确认截图
export default function CaptureView() {
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const [selection, setSelection] = useState<SelectionRect | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [result, setResult] = useState<ScreenshotResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [copying, setCopying] = useState(false)
  const [pinning, setPinning] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [monitors, setMonitors] = useState<MonitorInfo[]>([])
  const [selectedMonitorId, setSelectedMonitorId] = useState<number>('' as unknown as number)

  const {
    annotations,
    toolMode,
    color,
    pendingText,
    setToolMode,
    setColor,
    addAnnotation,
    commitText,
    cancelText,
    undo,
    clearAll,
  } = useAnnotations('#F44336')

  const imgRef = useRef<HTMLImageElement>(null)

  /// 加载显示器列表
  useEffect(() => {
    let cancelled = false
    listMonitors()
      .then((list) => {
        if (cancelled) return
        setMonitors(list)
        // 默认选中主显示器
        const primary = list.find((m) => m.isPrimary)
        setSelectedMonitorId(primary?.id ?? list[0]?.id ?? ('' as unknown as number))
      })
      .catch(() => {
        /* 加载失败保持空列表，后端回退主显示器 */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (result || loading) return
    const x = e.clientX
    const y = e.clientY
    setDragStart({ x, y })
    setIsDragging(true)
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
      const monitorId =
        selectedMonitorId === ('' as unknown as number) ? undefined : selectedMonitorId
      const res = await captureRegion(region, monitorId)
      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [selection, selectedMonitorId])

  /// 一键全屏截图：直接采集当前选中显示器
  const handleFullscreenCapture = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const monitorId =
        selectedMonitorId === ('' as unknown as number) ? undefined : selectedMonitorId
      const res = await captureFullscreen(monitorId)
      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [selectedMonitorId])

  /// 切换目标显示器
  const handleMonitorChange = useCallback((e: SelectChangeEvent<number>) => {
    const val = e.target.value as number
    setSelectedMonitorId(val)
    // 切换显示器时清除当前选区
    setSelection(null)
    setDragStart(null)
  }, [])

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
      const composed = await composeImage(
        toDataUrl(result),
        annotations,
        result.width,
        result.height,
      )
      const base64 = composed.split(',')[1]
      const path = await saveToFile(base64)
      setMessage(`已保存到: ${path}`)
      setTimeout(() => setMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }, [result, annotations])

  const handleCopy = useCallback(async () => {
    if (!result) return
    setCopying(true)
    try {
      const composed = await composeImage(
        toDataUrl(result),
        annotations,
        result.width,
        result.height,
      )
      const base64 = composed.split(',')[1]
      await copyToClipboard(base64)
      setMessage('已复制到剪贴板')
      setTimeout(() => setMessage(null), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setCopying(false)
    }
  }, [result, annotations])

  const handlePin = useCallback(async () => {
    if (!result) return
    setPinning(true)
    try {
      const composed = await composeImage(
        toDataUrl(result),
        annotations,
        result.width,
        result.height,
      )
      await pinImage(composed)
      setMessage('已贴图到桌面')
      setTimeout(() => setMessage(null), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setPinning(false)
    }
  }, [result, annotations])

  /// 在结果图上点击：添加标注
  const handleResultClick = useCallback(
    (e: React.MouseEvent) => {
      // 如果正在输入文字，不处理点击
      if (pendingText) return
      const img = imgRef.current
      if (!img) return
      const rect = img.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      addAnnotation(x, y)
    },
    [pendingText, addAnnotation],
  )

  // 截图结果展示 + 标注
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
          bgcolor: 'rgba(0, 0, 0, 0.9)',
          gap: 1,
        }}
      >
        {/* 图片 + SVG 标注层 */}
        <Box
          sx={{
            position: 'relative',
            maxWidth: '90%',
            maxHeight: '75%',
          }}
        >
          <Box
            component="img"
            ref={imgRef}
            src={toDataUrl(result)}
            alt="截图结果"
            onClick={handleResultClick}
            sx={{
              display: 'block',
              maxWidth: '100%',
              maxHeight: '75vh',
              border: '2px solid',
              borderColor: 'primary.main',
              borderRadius: 1,
              cursor: pendingText ? 'text' : 'crosshair',
              userSelect: 'none',
            }}
          />
          {/* SVG 标注覆盖层 */}
          <svg
            data-testid="annotation-layer"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
            }}
          >
            {annotations.map((ann) => {
              if (ann.type === 'number') {
                return (
                  <g key={ann.id} data-testid={`annotation-${ann.id}`}>
                    <circle
                      cx={ann.x}
                      cy={ann.y}
                      r={CIRCLE_RADIUS}
                      fill={ann.color}
                      stroke="white"
                      strokeWidth="2"
                    />
                    <text
                      x={ann.x}
                      y={ann.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="white"
                      fontSize="16"
                      fontWeight="bold"
                    >
                      {ann.sequence}
                    </text>
                  </g>
                )
              }
              return (
                <g key={ann.id} data-testid={`annotation-${ann.id}`}>
                  <rect
                    x={ann.x - 4}
                    y={ann.y - 12}
                    width={(ann.text?.length ?? 0) * 8 + 8}
                    height="22"
                    fill={ann.color}
                    rx="4"
                    opacity="0.9"
                  />
                  <text
                    x={ann.x}
                    y={ann.y}
                    textAnchor="start"
                    dominantBaseline="central"
                    fill="white"
                    fontSize="14"
                    fontWeight="bold"
                  >
                    {ann.text}
                  </text>
                </g>
              )
            })}
          </svg>

          {/* 文字输入框 */}
          {pendingText && (
            <Box
              sx={{
                position: 'absolute',
                left: pendingText.x,
                top: pendingText.y,
                zIndex: 10,
              }}
            >
              <TextField
                data-testid="text-annotation-input"
                size="small"
                autoFocus
                placeholder="输入标注文字..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    commitText((e.target as HTMLInputElement).value)
                  } else if (e.key === 'Escape') {
                    cancelText()
                  }
                }}
                onBlur={(e) => commitText(e.target.value)}
                sx={{
                  bgcolor: 'background.paper',
                  borderRadius: 1,
                  '& .MuiInput-root': { fontSize: 14 },
                }}
              />
            </Box>
          )}
        </Box>

        {/* 工具栏 */}
        <Stack
          data-testid="annotation-toolbar"
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{
            bgcolor: 'background.paper',
            borderRadius: 2,
            p: 1,
            boxShadow: 3,
          }}
        >
          {/* 工具模式切换 */}
          <ToggleButtonGroup
            value={toolMode}
            exclusive
            size="small"
            onChange={(_, val) => val && setToolMode(val)}
          >
            <ToggleButton value="number" data-testid="tool-number">
              <Tooltip title="数字标注">
                <FormatListNumberedIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="text" data-testid="tool-text">
              <Tooltip title="文字标注">
                <TextFieldsIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>

          {/* 颜色选择 */}
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {['#F44336', '#2196F3', '#4CAF50', '#FF9800'].map((c) => (
              <Box
                key={c}
                data-testid={`color-${c}`}
                onClick={() => setColor(c)}
                sx={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  bgcolor: c,
                  cursor: 'pointer',
                  border: color === c ? '3px solid white' : '2px solid transparent',
                  boxShadow: color === c ? '0 0 0 2px #1976d2' : 'none',
                }}
              />
            ))}
          </Box>

          {/* 撤销 */}
          <IconButton
            size="small"
            data-testid="undo-annotation"
            onClick={undo}
            disabled={annotations.length === 0}
          >
            <UndoIcon fontSize="small" />
          </IconButton>

          {/* 清除全部 */}
          <IconButton
            size="small"
            data-testid="clear-annotations"
            onClick={clearAll}
            disabled={annotations.length === 0}
          >
            <DeleteSweepIcon fontSize="small" />
          </IconButton>

          {/* 分隔线 */}
          <Box sx={{ width: 1, height: 28, bgcolor: 'divider' }} />

          {/* 保存 */}
          <IconButton
            data-testid="save-to-file"
            size="small"
            color="primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <CircularProgress size={18} /> : <SaveAltIcon fontSize="small" />}
          </IconButton>

          {/* 复制 */}
          <IconButton
            data-testid="copy-to-clipboard"
            size="small"
            color="primary"
            onClick={handleCopy}
            disabled={copying}
          >
            {copying ? <CircularProgress size={18} /> : <ContentCopyIcon fontSize="small" />}
          </IconButton>

          {/* 贴图 */}
          <IconButton
            data-testid="pin-to-desktop"
            size="small"
            color="primary"
            onClick={handlePin}
            disabled={pinning}
          >
            {pinning ? <CircularProgress size={18} /> : <PushPinIcon fontSize="small" />}
          </IconButton>

          {/* 关闭 */}
          <IconButton size="small" onClick={handleCancel}>
            <CloseIcon fontSize="small" />
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
              py: 0.5,
              borderRadius: 1,
            }}
          >
            {message}
          </Typography>
        )}

        {/* 错误提示 */}
        {error && (
          <Typography
            sx={{
              bgcolor: 'error.main',
              color: 'error.contrastText',
              px: 2,
              py: 0.5,
              borderRadius: 1,
            }}
          >
            {error}
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
      {/* 顶部固定工具栏：显示器选择 + 全屏截图 + 取消 */}
      <Box
        data-testid="capture-topbar"
        onMouseDown={(e) => e.stopPropagation()}
        sx={{
          position: 'fixed',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          bgcolor: 'background.paper',
          borderRadius: 2,
          p: 0.5,
          boxShadow: 3,
        }}
      >
        {monitors.length > 0 && (
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <Select
              data-testid="monitor-select"
              value={selectedMonitorId}
              onChange={handleMonitorChange}
              displayEmpty
              renderValue={(val) => {
                const m = monitors.find((x) => x.id === val)
                return (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <MonitorIcon fontSize="small" />
                    <Typography variant="caption">
                      {m ? m.name : '选择显示器'}
                    </Typography>
                  </Box>
                )
              }}
            >
              {monitors.map((m) => (
                <MenuItem key={m.id} value={m.id}>
                  <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    <Typography variant="body2">
                      {m.name}
                      {m.isPrimary ? '（主）' : ''}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {m.width}×{m.height} @ ({m.x},{m.y})
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <Button
          data-testid="fullscreen-capture-btn"
          size="small"
          startIcon={loading ? <CircularProgress size={16} /> : <FullscreenIcon />}
          onClick={handleFullscreenCapture}
          disabled={loading}
        >
          全屏截图
        </Button>
        <IconButton size="small" onClick={handleCancel}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

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

      {error && (
        <Box
          sx={{
            position: 'fixed',
            top: 80,
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
