import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  startRecorder,
  stopRecorder,
  cancelRecorder,
  recorderState,
  fullscreenConfig,
  regionConfig,
  DEFAULT_FPS,
} from './recorder.service'
import type { RecorderConfig } from './recorder.service'

// 模拟 @tauri-apps/api/core 的 invoke
const invokeMock = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}))

describe('recorder.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('fullscreenConfig', () => {
    it('应创建全屏配置，region 为 null', () => {
      const cfg = fullscreenConfig()
      expect(cfg.mode).toBe('Fullscreen')
      expect(cfg.region).toBeNull()
      expect(cfg.fps).toBe(DEFAULT_FPS)
    })

    it('应支持自定义 fps', () => {
      const cfg = fullscreenConfig(60)
      expect(cfg.fps).toBe(60)
    })

    it('默认输出格式为 Mp4 且无音频', () => {
      const cfg = fullscreenConfig()
      expect(cfg.outputFormat).toBe('Mp4')
      expect(cfg.audioEnabled).toBe(false)
    })

    it('支持指定 GIF 格式', () => {
      const cfg = fullscreenConfig(30, { outputFormat: 'Gif' })
      expect(cfg.outputFormat).toBe('Gif')
    })

    it('支持启用音频', () => {
      const cfg = fullscreenConfig(30, { audioEnabled: true })
      expect(cfg.audioEnabled).toBe(true)
    })
  })

  describe('regionConfig', () => {
    it('应创建选区配置，包含 region', () => {
      const region = { x: 10, y: 20, width: 640, height: 480 }
      const cfg = regionConfig(region)
      expect(cfg.mode).toBe('Region')
      expect(cfg.region).toEqual(region)
      expect(cfg.fps).toBe(DEFAULT_FPS)
    })

    it('应支持自定义 fps', () => {
      const cfg = regionConfig({ x: 0, y: 0, width: 100, height: 100 }, 24)
      expect(cfg.fps).toBe(24)
    })

    it('支持指定格式和音频', () => {
      const cfg = regionConfig(
        { x: 0, y: 0, width: 100, height: 100 },
        15,
        { outputFormat: 'Gif', audioEnabled: true },
      )
      expect(cfg.outputFormat).toBe('Gif')
      expect(cfg.audioEnabled).toBe(true)
    })
  })

  describe('startRecorder', () => {
    it('应调用 start_recorder command 并传入 config', async () => {
      invokeMock.mockResolvedValueOnce(undefined)
      const cfg: RecorderConfig = fullscreenConfig(30)
      await startRecorder(cfg)
      expect(invokeMock).toHaveBeenCalledWith('start_recorder', { config: cfg })
    })

    it('应透传后端错误', async () => {
      invokeMock.mockRejectedValueOnce('已有录屏进行中')
      await expect(startRecorder(fullscreenConfig())).rejects.toBe('已有录屏进行中')
    })
  })

  describe('stopRecorder', () => {
    it('应调用 stop_recorder command 并返回路径', async () => {
      invokeMock.mockResolvedValueOnce('/home/user/snapmaster_record_123.mp4')
      const path = await stopRecorder()
      expect(invokeMock).toHaveBeenCalledWith('stop_recorder')
      expect(path).toBe('/home/user/snapmaster_record_123.mp4')
    })

    it('应透传停止错误', async () => {
      invokeMock.mockRejectedValueOnce('没有活跃的录屏会话')
      await expect(stopRecorder()).rejects.toBe('没有活跃的录屏会话')
    })
  })

  describe('cancelRecorder', () => {
    it('应调用 cancel_recorder command', async () => {
      invokeMock.mockResolvedValueOnce(undefined)
      await cancelRecorder()
      expect(invokeMock).toHaveBeenCalledWith('cancel_recorder')
    })
  })

  describe('recorderState', () => {
    it('应调用 recorder_state command 并返回状态', async () => {
      invokeMock.mockResolvedValueOnce('Recording')
      const state = await recorderState()
      expect(invokeMock).toHaveBeenCalledWith('recorder_state')
      expect(state).toBe('Recording')
    })

    it('空闲时返回 Idle', async () => {
      invokeMock.mockResolvedValueOnce('Idle')
      const state = await recorderState()
      expect(state).toBe('Idle')
    })
  })
})
