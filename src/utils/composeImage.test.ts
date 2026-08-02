import { describe, it, expect, vi, beforeEach } from 'vitest'
import { composeImage } from './composeImage'
import type { Annotation } from '../types/annotation'

// 模拟 Canvas 2D 上下文
const ctxStub = {
  drawImage: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  fillText: vi.fn(),
  fillRect: vi.fn(),
  set fillStyle(v: string) { (this as Record<string, unknown>)._fillStyle = v },
  set strokeStyle(v: string) { (this as Record<string, unknown>)._strokeStyle = v },
  set lineWidth(v: number) { (this as Record<string, unknown>)._lineWidth = v },
  set font(v: string) { (this as Record<string, unknown>)._font = v },
  set textAlign(v: string) { (this as Record<string, unknown>)._textAlign = v },
  set textBaseline(v: string) { (this as Record<string, unknown>)._textBaseline = v },
}

// 模拟 canvas
const canvasStub = {
  width: 0,
  height: 0,
  toDataURL: vi.fn().mockReturnValue('data:image/png;base64,composedImage'),
  getContext: vi.fn().mockReturnValue(ctxStub),
}

// 模拟 Image
function mockImage(width = 200, height = 150) {
  const img = {
    width,
    height,
    onload: null as (() => void) | null,
    _src: '',
  }
  // 模拟设置 src 后异步触发 onload
  Object.defineProperty(img, 'src', {
    set(val: string) {
      img._src = val
      setTimeout(() => img.onload?.(), 0)
    },
    get() {
      return img._src
    },
  })
  return img
}

// 模拟 document.createElement
const originalCreateElement = document.createElement.bind(document)

beforeEach(() => {
  vi.clearAllMocks()
  // 重置 canvas 尺寸
  canvasStub.width = 0
  canvasStub.height = 0
  // 拦截 canvas 和 image 创建
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'canvas') return canvasStub as unknown as HTMLCanvasElement
    if (tag === 'img') return mockImage() as unknown as HTMLImageElement
    return originalCreateElement(tag)
  })
})

describe('composeImage', () => {
  it('应设置 canvas 尺寸为图片尺寸', async () => {
    await composeImage('data:image/png;base64,abc', [], 200, 150)
    expect(canvasStub.width).toBe(200)
    expect(canvasStub.height).toBe(150)
  })

  it('应将原图绘制到 canvas', async () => {
    await composeImage('data:image/png;base64,abc', [], 200, 150)
    expect(ctxStub.drawImage).toHaveBeenCalled()
  })

  it('无标注时应直接返回原图 Base64', async () => {
    await composeImage('data:image/png;base64,abc', [], 200, 150)
    expect(ctxStub.arc).not.toHaveBeenCalled()
    expect(canvasStub.toDataURL).toHaveBeenCalled()
  })

  it('数字标注应绘制圆圈和数字', async () => {
    const annotations: Annotation[] = [
      {
        id: 'num-1',
        type: 'number',
        x: 50,
        y: 60,
        color: '#F44336',
        sequence: 1,
      },
    ]
    await composeImage('data:image/png;base64,abc', annotations, 200, 150)
    expect(ctxStub.beginPath).toHaveBeenCalled()
    expect(ctxStub.arc).toHaveBeenCalledWith(50, 60, 20, 0, Math.PI * 2)
    expect(ctxStub.fill).toHaveBeenCalled()
    expect(ctxStub.stroke).toHaveBeenCalled()
    expect(ctxStub.fillText).toHaveBeenCalledWith('1', 50, 60)
  })

  it('文字标注应绘制背景矩形和文字', async () => {
    const annotations: Annotation[] = [
      {
        id: 'text-1',
        type: 'text',
        x: 30,
        y: 40,
        color: '#2196F3',
        text: 'Hello',
      },
    ]
    await composeImage('data:image/png;base64,abc', annotations, 200, 150)
    expect(ctxStub.fillRect).toHaveBeenCalled()
    expect(ctxStub.fillText).toHaveBeenCalledWith('Hello', 30, 40)
  })

  it('多个标注应全部绘制', async () => {
    const annotations: Annotation[] = [
      { id: 'n1', type: 'number', x: 10, y: 10, color: '#F44336', sequence: 1 },
      { id: 'n2', type: 'number', x: 50, y: 50, color: '#F44336', sequence: 2 },
      { id: 't1', type: 'text', x: 80, y: 80, color: '#2196F3', text: '标注' },
    ]
    await composeImage('data:image/png;base64,abc', annotations, 200, 150)
    // 2 个圆圈 + 1 个文字矩形
    expect(ctxStub.arc).toHaveBeenCalledTimes(2)
    expect(ctxStub.fillRect).toHaveBeenCalledTimes(1)
    // 3 个文字（2 数字 + 1 文字）
    expect(ctxStub.fillText).toHaveBeenCalledTimes(3)
  })

  it('返回值应为 data URL 格式', async () => {
    const result = await composeImage('data:image/png;base64,abc', [], 200, 150)
    expect(result).toBe('data:image/png;base64,composedImage')
  })
})
