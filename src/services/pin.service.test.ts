import { describe, it, expect, vi, beforeEach } from 'vitest'
import { pinImage, takePinImage, closePinWindow } from './pin.service'

// 模拟 @tauri-apps/api/core 的 invoke
const invokeMock = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}))

// 模拟 window.service
const createWindowMock = vi.fn()
const closeWindowMock = vi.fn()
vi.mock('./window.service', () => ({
  createWindow: (...args: unknown[]) => createWindowMock(...args),
  closeWindow: (...args: unknown[]) => closeWindowMock(...args),
}))

describe('pin.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
    invokeMock.mockResolvedValue(undefined)
    createWindowMock.mockResolvedValue('pin-123')
    closeWindowMock.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('pinImage', () => {
    it('应先暂存数据再创建窗口', async () => {
      await pinImage('data:image/png;base64,AAA')

      expect(invokeMock).toHaveBeenCalledWith('stash_pin_image', {
        label: expect.stringMatching(/^pin-\d+$/),
        dataUrl: 'data:image/png;base64,AAA',
      })
      // createWindow 收到的是 suffix（纯数字），Rust 端拼成 pin-{suffix}
      expect(createWindowMock).toHaveBeenCalledWith('pin', expect.stringMatching(/^\d+$/))
    })

    it('暂存应在创建窗口之前调用', async () => {
      const callOrder: string[] = []
      invokeMock.mockImplementation(async (cmd: string) => {
        callOrder.push(cmd)
        return undefined
      })
      createWindowMock.mockImplementation(async (..._args: unknown[]) => {
        callOrder.push('createWindow')
        return 'pin-1'
      })

      await pinImage('data:url')

      expect(callOrder[0]).toBe('stash_pin_image')
      expect(callOrder[1]).toBe('createWindow')
    })

    it('应返回 pin-{时间戳} 格式的 label', async () => {
      const label = await pinImage('data:url')
      expect(label).toBe('pin-1767225600000')
    })

    it('label 应基于时间戳且唯一', async () => {
      const label1 = await pinImage('data:1')
      vi.advanceTimersByTime(5)
      const label2 = await pinImage('data:2')
      expect(label1).not.toBe(label2)
    })

    it('stash 的 label 与返回的 label 一致', async () => {
      const label = await pinImage('data:url')
      const stashCall = invokeMock.mock.calls.find((c) => c[0] === 'stash_pin_image')
      expect(stashCall![1].label).toBe(label)
    })
  })

  describe('takePinImage', () => {
    it('应调用 take_pin_image 命令', async () => {
      invokeMock.mockResolvedValue('data:image/png;base64,BBB')
      const result = await takePinImage('pin-123')
      expect(invokeMock).toHaveBeenCalledWith('take_pin_image', { label: 'pin-123' })
      expect(result).toBe('data:image/png;base64,BBB')
    })

    it('数据不存在时应返回 null', async () => {
      invokeMock.mockResolvedValue(null)
      const result = await takePinImage('pin-not-exist')
      expect(result).toBeNull()
    })
  })

  describe('closePinWindow', () => {
    it('应调用 closeWindow', async () => {
      await closePinWindow('pin-123')
      expect(closeWindowMock).toHaveBeenCalledWith('pin-123')
    })
  })
})
