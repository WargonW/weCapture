import { describe, it, expect, vi, beforeEach } from 'vitest'
import { capturePixel, toHex, toRgbString, copyText, type RgbColor } from './color.service'

const invokeMock = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}))

describe('color.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('capturePixel', () => {
    it('应调用 capture_pixel 命令并传坐标', async () => {
      const fake: RgbColor = { r: 255, g: 0, b: 0 }
      invokeMock.mockResolvedValue(fake)

      const result = await capturePixel(100, 200)

      expect(invokeMock).toHaveBeenCalledWith('capture_pixel', { x: 100, y: 200 })
      expect(result).toEqual(fake)
    })
  })

  describe('toHex', () => {
    it('应转为 #RRGGBB 大写格式', () => {
      expect(toHex({ r: 255, g: 0, b: 0 })).toBe('#FF0000')
      expect(toHex({ r: 0, g: 255, b: 0 })).toBe('#00FF00')
      expect(toHex({ r: 0, g: 0, b: 255 })).toBe('#0000FF')
      expect(toHex({ r: 255, g: 255, b: 255 })).toBe('#FFFFFF')
      expect(toHex({ r: 0, g: 0, b: 0 })).toBe('#000000')
    })

    it('单数应补零', () => {
      expect(toHex({ r: 18, g: 52, b: 86 })).toBe('#123456')
      expect(toHex({ r: 1, g: 2, b: 3 })).toBe('#010203')
    })
  })

  describe('toRgbString', () => {
    it('应转为 rgb(r,g,b) 格式', () => {
      expect(toRgbString({ r: 255, g: 0, b: 0 })).toBe('rgb(255,0,0)')
      expect(toRgbString({ r: 18, g: 52, b: 86 })).toBe('rgb(18,52,86)')
    })
  })

  describe('copyText', () => {
    it('应优先用 Clipboard API', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
      })

      await copyText('#FF0000')

      expect(writeText).toHaveBeenCalledWith('#FF0000')
    })

    it('Clipboard API 失败应回退到 execCommand', async () => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
        configurable: true,
      })
      const execMock = vi.fn().mockReturnValue(true)
      document.execCommand = execMock

      await copyText('#FF0000')

      expect(execMock).toHaveBeenCalledWith('copy')
    })
  })
})
