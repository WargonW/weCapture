import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Box,
  IconButton,
  Typography,
  Button,
  CircularProgress,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip,
} from '@mui/material'
import { LogicalSize, getCurrentWindow } from '@tauri-apps/api/window'
import CloseIcon from '@mui/icons-material/Close'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import StopIcon from '@mui/icons-material/Stop'
import FullscreenIcon from '@mui/icons-material/Fullscreen'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import MovieIcon from '@mui/icons-material/Movie'
import GifBoxIcon from '@mui/icons-material/GifBox'
import GraphicEqIcon from '@mui/icons-material/GraphicEq'
import {
  startRecorder,
  stopRecorder,
  cancelRecorder,
  fullscreenConfig,
  regionConfig,
} from '../services/recorder.service'
import type { OutputFormat } from '../services/recorder.service'
import { closeWindow } from '../services/window.service'
import type { CaptureRegion } from '../types/capture'
import { regionFromPoints } from '../types/capture'

/// 录屏阶段
type Phase = 'select' | 'recording' | 'done'

/// 控制条尺寸
const CONTROL_W = 280
const CONTROL_H = 64

/// 选区状态
interface SelectionRect {
  x: number
  y: number
  width: number
  height: number
}

/// 格式化时长为 mm:ss
function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60)
    .toString()
    .padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export default function RecorderView() {
  const win = getCurrentWindow()
  const [phase, setPhase] = useState<Phase>('select')
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const [selection, setSelection] = useState<SelectionRect | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [resultPath, setResultPath] = useState<string | null>(null)
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('Mp4')
  const [audioEnabled, setAudioEnabled] = useState(false)
  const timerRef = useRef<number | null>(null)

  /// 选区拖拽
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (phase !== 'select' || loading) return
      setDragStart({ x: e.clientX, y: e.clientY })
      setIsDragging(true)
      setSelection(null)
      setError(null)
    },
    [phase, loading],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !dragStart) return
      const region = regionFromPoints(dragStart.x, dragStart.y, e.clientX, e.clientY)
      setSelection(region)
    },
    [isDragging, dragStart],
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  /// 缩小为控制条
  const shrinkToControlBar = useCallback(async () => {
    try {
      await win.setFullscreen(false)
      await win.setSize(new LogicalSize(CONTROL_W, CONTROL_H))
      await win.setAlwaysOnTop(true)
    } catch (e) {
      // 窗口操作失败不阻断录制
      console.error('调整窗口失败:', e)
    }
  }, [win])

  /// 开始录制
  const handleStart = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const opts = {
        outputFormat,
        // GIF 模式不录制音频
        audioEnabled: outputFormat === 'Mp4' && audioEnabled,
      }
      let config
      if (selection && selection.width > 0 && selection.height > 0) {
        config = regionConfig(selection as CaptureRegion, 30, opts)
      } else {
        config = fullscreenConfig(30, opts)
      }
      await startRecorder(config)
      await shrinkToControlBar()
      setPhase('recording')
      setElapsed(0)
      const start = Date.now()
      timerRef.current = window.setInterval(() => {
        setElapsed(Math.floor((Date.now() - start) / 1000))
      }, 250)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [selection, shrinkToControlBar, outputFormat, audioEnabled])

  /// 停止录制
  const handleStop = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setLoading(true)
    setError(null)
    try {
      const path = await stopRecorder()
      setResultPath(path)
      setPhase('done')
      // 3 秒后关闭窗口
      setTimeout(() => {
        closeWindow(win.label).catch(() => {})
      }, 3000)
    } catch (e) {
      setError(String(e))
      setPhase('select')
      // 恢复全屏选区
      win.setFullscreen(true).catch(() => {})
    } finally {
      setLoading(false)
    }
  }, [win])

  /// 取消
  const handleCancel = useCallback(async () => {
    try {
      await cancelRecorder()
    } catch {
      /* 忽略取消错误 */
    }
    closeWindow(win.label).catch(() => {})
  }, [win.label])

  /// 清理计时器
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  /// Esc：select 阶段取消，recording 阶段停止
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (phase === 'select') handleCancel()
      else if (phase === 'recording') handleStop()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, handleCancel, handleStop])

  // ===== 完成阶段 =====
  if (phase === 'done') {
    return (
      <Box
        data-testid="recorder-message"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          p: 2,
          bgcolor: 'success.main',
          color: 'success.contrastText',
          borderRadius: 2,
        }}
      >
        <Typography variant="body2">已保存: {resultPath}</Typography>
      </Box>
    )
  }

  // ===== 录制中阶段 =====
  if (phase === 'recording') {
    return (
      <Box
        data-testid="recorder-control"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          p: 1,
          px: 2,
          borderRadius: 3,
          bgcolor: 'background.paper',
          boxShadow: 3,
          userSelect: 'none',
        }}
      >
        <FiberManualRecordIcon color="error" fontSize="small" />
        <Typography
          data-testid="recorder-timer"
          variant="body2"
          fontWeight="bold"
          sx={{ minWidth: 48 }}
        >
          {formatDuration(elapsed)}
        </Typography>
        <IconButton
          data-testid="recorder-stop-btn"
          size="small"
          color="error"
          onClick={handleStop}
          disabled={loading}
        >
          {loading ? <CircularProgress size={18} /> : <StopIcon fontSize="small" />}
        </IconButton>
        {error && (
          <Typography
            data-testid="recorder-error"
            variant="caption"
            color="error"
            sx={{ ml: 1 }}
          >
            {error}
          </Typography>
        )}
      </Box>
    )
  }

  // ===== 选区阶段 =====
  return (
    <Box
      data-testid="recorder-overlay"
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
      {selection && selection.width > 0 && selection.height > 0 && (
        <Box
          data-testid="recorder-selection"
          sx={{
            position: 'absolute',
            left: selection.x,
            top: selection.y,
            width: selection.width,
            height: selection.height,
            border: '2px solid',
            borderColor: 'error.main',
            bgcolor: 'rgba(244, 67, 54, 0.1)',
            pointerEvents: 'none',
          }}
        />
      )}

      {selection && !isDragging && selection.width > 0 && selection.height > 0 && (
        <Box
          data-testid="recorder-toolbar"
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
          <Button
            data-testid="recorder-start-btn"
            size="small"
            color="error"
            variant="contained"
            startIcon={<PlayArrowIcon />}
            onClick={handleStart}
            disabled={loading}
          >
            {loading ? '开始中...' : '开始录屏'}
          </Button>
          <IconButton
            data-testid="recorder-cancel-btn"
            size="small"
            color="error"
            onClick={handleCancel}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      )}

      {/* 顶部固定工具栏：格式选择 + 全屏录屏 + 取消 */}
      <Box
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
        <ToggleButtonGroup
          data-testid="recorder-format-group"
          size="small"
          exclusive
          value={outputFormat}
          onChange={(_, v: OutputFormat | null) => {
            if (v) setOutputFormat(v)
          }}
        >
          <ToggleButton data-testid="recorder-format-mp4" value="Mp4">
            <MovieIcon fontSize="small" />
            <Typography variant="caption" sx={{ ml: 0.5 }}>
              MP4
            </Typography>
          </ToggleButton>
          <ToggleButton data-testid="recorder-format-gif" value="Gif">
            <GifBoxIcon fontSize="small" />
            <Typography variant="caption" sx={{ ml: 0.5 }}>
              GIF
            </Typography>
          </ToggleButton>
        </ToggleButtonGroup>

        <Tooltip title={outputFormat === 'Mp4' ? '录制系统音频' : 'GIF 不支持音频'}>
          <IconButton
            data-testid="recorder-audio-toggle"
            size="small"
            color={audioEnabled ? 'primary' : 'default'}
            disabled={outputFormat !== 'Mp4'}
            onClick={() => setAudioEnabled((v) => !v)}
          >
            <GraphicEqIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Button
          data-testid="recorder-fullscreen-btn"
          size="small"
          startIcon={<FullscreenIcon />}
          onClick={handleStart}
          disabled={loading}
        >
          全屏录屏
        </Button>
        <IconButton size="small" onClick={handleCancel}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* 提示 */}
      <Typography
        sx={{
          position: 'fixed',
          top: 60,
          left: '50%',
          transform: 'translateX(-50%)',
          color: 'common.white',
          bgcolor: 'rgba(0,0,0,0.5)',
          px: 1,
          borderRadius: 1,
          fontSize: 12,
          pointerEvents: 'none',
        }}
      >
        拖拽选区录屏 · 或点上方「全屏录屏」· Esc 取消
      </Typography>

      {error && (
        <Box
          data-testid="recorder-error"
          sx={{
            position: 'fixed',
            top: 90,
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
