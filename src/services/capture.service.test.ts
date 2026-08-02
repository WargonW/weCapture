import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  captureFullscreen,
  captureRegion,
  monitorCount,
} from './capture.service'
import type { ScreenshotResult } from '../types/capture'

// 模拟 @tauri-apps/api/core 的 invoke
const invokeMock = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}))

const fakeResult: ScreenshotResult = {
  imageData: 'iVBORw0KGgo=',
  width: 1920,
  height: 1080,
}

describe('capture.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('captureFullscreen', () => {
    it('应调用 capture_fullscreen command 且无参数', async () => {
      invokeMock.mockResolvedValueOnce(fakeResult)
      const result = await captureFullscreen()
      expect(invokeMock).toHaveBeenCalledWith('capture_fullscreen')
      expect(result).toEqual(fakeResult)
    })

    it('应透传后端返回的错误', async () => {
      invokeMock.mockRejectedValueOnce('没有可用的显示器')
      await expect(captureFullscreen()).rejects.toBe('没有可用的显示器')
    })
  })

  describe('captureRegion', () => {
    it('应以 snake_case 形式传入选区参数', async () => {
      invokeMock.mockResolvedValueOnce(fakeResult)
      const region = { x: 100, y: 100, width: 200, height: 150 }
      await captureRegion(region)
      expect(invokeMock).toHaveBeenCalledWith('capture_region', { region })
    })

    it('应返回后端的截图结果', async () => {
      invokeMock.mockResolvedValueOnce(fakeResult)
      const result = await captureRegion({ x: 0, y: 0, width: 10, height: 10 })
      expect(result).toEqual(fakeResult)
    })
  })

  describe('monitorCount', () => {
    it('应调用 monitor_count command 并返回数值', async () => {
      invokeMock.mockResolvedValueOnce(2)
      const count = await monitorCount()
      expect(invokeMock).toHaveBeenCalledWith('monitor_count')
      expect(count).toBe(2)
    })
  })
})
