/// 截图模式
export type CaptureMode = 'Fullscreen' | 'Region' | 'Window'

/// 截图选区：以左上角为原点的矩形区域
export interface CaptureRegion {
  x: number
  y: number
  width: number
  height: number
}

/// 截图结果
export interface ScreenshotResult {
  /// Base64 编码的 PNG 图片数据
  imageData: string
  /// 图片宽度
  width: number
  /// 图片高度
  height: number
}

/// 工具：把 ScreenshotResult 转为可直接用于 <img src> 的 data URL
export function toDataUrl(result: ScreenshotResult): string {
  return `data:image/png;base64,${result.imageData}`
}

/// 工具：从两个点构造选区
export function regionFromPoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): CaptureRegion {
  const x = Math.min(x1, x2)
  const y = Math.min(y1, y2)
  const width = Math.max(1, Math.max(x1, x2) - x)
  const height = Math.max(1, Math.max(y1, y2) - y)
  return { x, y, width, height }
}
