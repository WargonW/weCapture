import { useState, useEffect, useCallback, useRef } from 'react'
import { Box, Typography, CircularProgress } from '@mui/material'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { capturePixel, toHex, toRgbString, copyText, type RgbColor } from '../services/color.service'
import { closeWindow } from '../services/window.service'

/// 放大镜边长（像素）
const LENS_SIZE = 120

export default function ColorPickerView() {
  const win = getCurrentWindow()
  const [color, setColor] = useState<RgbColor | null>(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const throttleRef = useRef<number>(0)

  /// 鼠标移动节流取色（每 60ms 最多一次）
  const handleMove = useCallback(
    (e: MouseEvent) => {
      const now = Date.now()
      if (now - throttleRef.current < 60) return
      throttleRef.current = now
      setPos({ x: e.screenX, y: e.screenY })
      setLoading(true)
      capturePixel(e.screenX, e.screenY)
        .then((c) => {
          setColor(c)
          setError(null)
        })
        .catch((err) => setError(String(err)))
        .finally(() => setLoading(false))
    },
    [],
  )

  useEffect(() => {
    window.addEventListener('mousemove', handleMove)
    return () => window.removeEventListener('mousemove', handleMove)
  }, [handleMove])

  /// 点击采集：复制 HEX + 关闭
  const handleClick = useCallback(async () => {
    if (!color) return
    try {
      await copyText(toHex(color))
      setMessage('已复制: ' + toHex(color))
    } catch (e) {
      setError(String(e))
    } finally {
      // 短暂展示后关闭
      setTimeout(() => {
        closeWindow(win.label).catch(() => {})
      }, 300)
    }
  }, [color, win.label])

  /// Esc 取消关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeWindow(win.label).catch(() => {})
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [win.label])

  const hex = color ? toHex(color) : '#000000'
  const rgbStr = color ? toRgbString(color) : 'rgb(0,0,0)'

  return (
    <Box
      data-testid="color-picker"
      onMouseMove={(e) => handleMove(e.nativeEvent)}
      onClick={handleClick}
      sx={{
        width: '100vw',
        height: '100vh',
        cursor: 'crosshair',
        bgcolor: 'rgba(0,0,0,0.01)',
        position: 'relative',
        userSelect: 'none',
      }}
    >
      {/* 放大镜（跟随鼠标） */}
      <Box
        data-testid="color-lens"
        sx={{
          position: 'absolute',
          left: pos.x + 16,
          top: pos.y + 16,
          width: LENS_SIZE,
          height: LENS_SIZE + 56,
          pointerEvents: 'none',
        }}
      >
        {/* 颜色预览块 */}
        <Box
          data-testid="color-preview"
          sx={{
            width: LENS_SIZE,
            height: LENS_SIZE,
            borderRadius: 1,
            border: '2px solid',
            borderColor: 'common.white',
            boxShadow: 3,
            bgcolor: hex,
          }}
        />
        {/* 色值信息 */}
        <Box
          sx={{
            mt: 0.5,
            px: 1,
            py: 0.5,
            borderRadius: 1,
            bgcolor: 'rgba(0,0,0,0.7)',
            color: 'common.white',
          }}
        >
          {loading && !color ? (
            <CircularProgress size={12} sx={{ color: 'common.white' }} />
          ) : (
            <>
              <Typography variant="caption" fontWeight="bold" display="block">
                {hex}
              </Typography>
              <Typography variant="caption" display="block">
                {rgbStr}
              </Typography>
            </>
          )}
        </Box>
      </Box>

      {/* 错误提示 */}
      {error && (
        <Typography
          data-testid="color-error"
          sx={{
            position: 'absolute',
            top: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            bgcolor: 'error.main',
            color: 'error.contrastText',
            px: 1,
            borderRadius: 1,
            fontSize: 12,
          }}
        >
          {error}
        </Typography>
      )}

      {/* 采集成功提示 */}
      {message && (
        <Typography
          data-testid="color-message"
          sx={{
            position: 'absolute',
            top: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            bgcolor: 'success.main',
            color: 'success.contrastText',
            px: 1,
            borderRadius: 1,
            fontSize: 12,
          }}
        >
          {message}
        </Typography>
      )}

      {/* 顶部提示 */}
      <Typography
        data-testid="color-hint"
        sx={{
          position: 'absolute',
          top: 8,
          left: 8,
          bgcolor: 'rgba(0,0,0,0.6)',
          color: 'common.white',
          px: 1,
          py: 0.25,
          borderRadius: 1,
          fontSize: 12,
          pointerEvents: 'none',
        }}
      >
        点击采集 · Esc 取消
      </Typography>
    </Box>
  )
}
