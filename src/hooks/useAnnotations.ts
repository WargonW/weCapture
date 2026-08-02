import { useState, useCallback } from 'react'
import type { Annotation } from '../types/annotation'
import {
  createNumberAnnotation,
  createTextAnnotation,
  nextSequence,
} from '../types/annotation'

/// 标注工具模式
export type ToolMode = 'number' | 'text'

/// 标注状态管理 hook
export function useAnnotations(defaultColor: string = '#F44336') {
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [toolMode, setToolMode] = useState<ToolMode>('number')
  const [color, setColor] = useState(defaultColor)
  const [pendingText, setPendingText] = useState<{ x: number; y: number } | null>(null)

  /// 在指定坐标添加标注
  const addAnnotation = useCallback(
    (x: number, y: number) => {
      if (toolMode === 'number') {
        const seq = nextSequence(annotations)
        const ann = createNumberAnnotation(x, y, seq, color)
        setAnnotations((prev) => [...prev, ann])
      } else {
        // 文字模式：先记录位置，等待文字输入
        setPendingText({ x, y })
      }
    },
    [toolMode, annotations, color],
  )

  /// 确认文字标注
  const commitText = useCallback(
    (text: string) => {
      if (!pendingText || !text.trim()) {
        setPendingText(null)
        return
      }
      const ann = createTextAnnotation(pendingText.x, pendingText.y, text.trim(), color)
      setAnnotations((prev) => [...prev, ann])
      setPendingText(null)
    },
    [pendingText, color],
  )

  /// 取消文字输入
  const cancelText = useCallback(() => {
    setPendingText(null)
  }, [])

  /// 撤销最后一个标注
  const undo = useCallback(() => {
    setAnnotations((prev) => prev.slice(0, -1))
  }, [])

  /// 清除所有标注
  const clearAll = useCallback(() => {
    setAnnotations([])
    setPendingText(null)
  }, [])

  /// 删除指定标注
  const remove = useCallback((id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id))
  }, [])

  return {
    annotations,
    toolMode,
    color,
    pendingText,
    setToolMode,
    setColor,
    addAnnotation,
    commitText,
    cancelText,
    undo,
    clearAll,
    remove,
  }
}
