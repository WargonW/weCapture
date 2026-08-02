import type { Annotation } from '../types/annotation'

/// 数字标注圆圈半径
const CIRCLE_RADIUS = 20

/// 将截图 + 标注合成为一张图片，返回 data URL
export async function composeImage(
  imageDataUrl: string,
  annotations: Annotation[],
  width: number,
  height: number,
): Promise<string> {
  // 加载原图
  const img = await loadImage(imageDataUrl)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!

  // 绘制原图
  ctx.drawImage(img, 0, 0, width, height)

  // 绘制标注
  for (const ann of annotations) {
    if (ann.type === 'number') {
      drawNumberAnnotation(ctx, ann)
    } else {
      drawTextAnnotation(ctx, ann)
    }
  }

  return canvas.toDataURL('image/png')
}

/// 加载图片
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img')
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/// 绘制数字标注圆圈
function drawNumberAnnotation(
  ctx: CanvasRenderingContext2D,
  ann: Annotation,
): void {
  ctx.beginPath()
  ctx.arc(ann.x, ann.y, CIRCLE_RADIUS, 0, Math.PI * 2)
  ctx.fillStyle = ann.color
  ctx.fill()
  ctx.strokeStyle = 'white'
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.fillStyle = 'white'
  ctx.font = 'bold 16px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(ann.sequence), ann.x, ann.y)
}

/// 绘制文字标注
function drawTextAnnotation(
  ctx: CanvasRenderingContext2D,
  ann: Annotation,
): void {
  const text = ann.text ?? ''
  const padding = 4
  const fontSize = 14
  const charWidth = 8
  const rectWidth = text.length * charWidth + padding * 2
  const rectHeight = fontSize + padding * 2

  ctx.fillStyle = ann.color
  ctx.fillRect(ann.x - padding, ann.y - fontSize + padding / 2, rectWidth, rectHeight)

  ctx.fillStyle = 'white'
  ctx.font = `bold ${fontSize}px sans-serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, ann.x, ann.y)
}
