import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  captureFullscreen,
  captureRegion,
  monitorCount,
  listMonitors,
  saveToFile,
  copyToClipboard,
} from './capture.service'
import type { MonitorInfo, ScreenshotResult } from '../types/capture'

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

const fakeMonitors: MonitorInfo[] = [
  { id: 1, name: 'Display 1', x: 0, y: 0, width: 1920, height: 1080, isPrimary: true },
  { id: 2, name: 'Display 2', x: 1920, y: 0, width: 1920, height: 1080, isPrimary: false },
]

describe('capture.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('captureFullscreen', () => {
    it('不传 monitorId 时应传 null', async () => {
      invokeMock.mockResolvedValueOnce(fakeResult)
      await captureFullscreen()
      expect(invokeMock).toHaveBeenCalledWith('capture_fullscreen', { monitorId: null })
    })

    it('传 monitorId 时应透传', async () => {
      invokeMock.mockResolvedValueOnce(fakeResult)
      await captureFullscreen(2)
      expect(invokeMock).toHaveBeenCalledWith('capture_fullscreen', { monitorId: 2 })
    })

    it('应返回后端的截图结果', async () => {
      invokeMock.mockResolvedValueOnce(fakeResult)
      const result = await captureFullscreen()
      expect(result).toEqual(fakeResult)
    })

    it('应透传后端返回的错误', async () => {
      invokeMock.mockRejectedValueOnce('没有可用的显示器')
      await expect(captureFullscreen()).rejects.toBe('没有可用的显示器')
    })
  })

  describe('captureRegion', () => {
    it('不传 monitorId 时应以 null 调用', async () => {
      invokeMock.mockResolvedValueOnce(fakeResult)
      const region = { x: 100, y: 100, width: 200, height: 150 }
      await captureRegion(region)
      expect(invokeMock).toHaveBeenCalledWith('capture_region', {
        region,
        monitorId: null,
      })
    })

    it('传 monitorId 时应透传', async () => {
      invokeMock.mockResolvedValueOnce(fakeResult)
      const region = { x: 100, y: 100, width: 200, height: 150 }
      await captureRegion(region, 2)
      expect(invokeMock).toHaveBeenCalledWith('capture_region', {
        region,
        monitorId: 2,
      })
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

  describe('listMonitors', () => {
    it('应调用 list_monitors command 并返回显示器列表', async () => {
      invokeMock.mockResolvedValueOnce(fakeMonitors)
      const monitors = await listMonitors()
      expect(invokeMock).toHaveBeenCalledWith('list_monitors')
      expect(monitors).toHaveLength(2)
      expect(monitors[0].id).toBe(1)
      expect(monitors[0].isPrimary).toBe(true)
      expect(monitors[1].x).toBe(1920)
    })

    it('应透传后端错误', async () => {
      invokeMock.mockRejectedValueOnce('获取显示器列表失败')
      await expect(listMonitors()).rejects.toBe('获取显示器列表失败')
    })
  })

  describe('saveToFile', () => {
    it('应调用 save_to_file command 并传入 imageData', async () => {
      invokeMock.mockResolvedValueOnce('/home/user/snapmaster_123.png')
      const path = await saveToFile('iVBORw0KGgo=')
      expect(invokeMock).toHaveBeenCalledWith('save_to_file', {
        imageData: 'iVBORw0KGgo=',
      })
      expect(path).toBe('/home/user/snapmaster_123.png')
    })
  })

  describe('copyToClipboard', () => {
    it('应调用 copy_to_clipboard command 并传入 imageData', async () => {
      invokeMock.mockResolvedValueOnce(undefined)
      await copyToClipboard('iVBORw0KGgo=')
      expect(invokeMock).toHaveBeenCalledWith('copy_to_clipboard', {
        imageData: 'iVBORw0KGgo=',
      })
    })
  })
})
