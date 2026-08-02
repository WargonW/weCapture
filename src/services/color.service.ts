import { invoke } from '@tauri-apps/api/core'

/// RGB 颜色（与 Rust 端 RgbColor 一致）
export interface RgbColor {
  r: number
  g: number
  b: number
}

/// 采集指定屏幕坐标的像素颜色
export async function capturePixel(x: number, y: number): Promise<RgbColor> {
  return invoke<RgbColor>('capture_pixel', { x, y })
}

/// 转 #RRGGBB 格式（大写）
export function toHex(c: RgbColor): string {
  const h = (n: number) => n.toString(16).padStart(2, '0').toUpperCase()
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`
}

/// 转 rgb(r,g,b) 格式
export function toRgbString(c: RgbColor): string {
  return `rgb(${c.r},${c.g},${c.b})`
}

/// 复制文本到剪贴板（复用后端 copy_to_clipboard，传空 base64 不合适，
/// 这里直接用浏览器 Clipboard API，失败回退到 document.execCommand）
export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    return
  } catch {
    // 回退方案
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
}
