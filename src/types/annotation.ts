/// 标注类型
export type AnnotationType = 'number' | 'text'

/// 标注基础结构
export interface Annotation {
  /// 唯一标识
  id: string
  /// 标注类型
  type: AnnotationType
  /// 在图片上的 x 坐标（相对于图片左上角）
  x: number
  /// 在图片上的 y 坐标
  y: number
  /// 颜色，默认红色
  color: string
  /// 数字标注的序号（type === 'number' 时使用）
  sequence?: number
  /// 文字标注的内容（type === 'text' 时使用）
  text?: string
}

/// 创建数字标注
export function createNumberAnnotation(
  x: number,
  y: number,
  sequence: number,
  color: string = '#F44336',
): Annotation {
  return {
    id: `num-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'number',
    x,
    y,
    color,
    sequence,
  }
}

/// 创建文字标注
export function createTextAnnotation(
  x: number,
  y: number,
  text: string,
  color: string = '#F44336',
): Annotation {
  return {
    id: `text-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'text',
    x,
    y,
    color,
    text,
  }
}

/// 计算下一个数字标注的序号
export function nextSequence(annotations: Annotation[]): number {
  const numbers = annotations
    .filter((a) => a.type === 'number')
    .map((a) => a.sequence ?? 0)
  return numbers.length === 0 ? 1 : Math.max(...numbers) + 1
}
