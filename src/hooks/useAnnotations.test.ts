import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAnnotations } from './useAnnotations'

describe('useAnnotations', () => {
  describe('数字标注模式（默认）', () => {
    it('初始状态无标注', () => {
      const { result } = renderHook(() => useAnnotations())
      expect(result.current.annotations).toEqual([])
      expect(result.current.toolMode).toBe('number')
    })

    it('点击添加数字标注，从1开始递增', () => {
      const { result } = renderHook(() => useAnnotations())

      act(() => {
        result.current.addAnnotation(100, 200)
      })
      expect(result.current.annotations).toHaveLength(1)
      expect(result.current.annotations[0].type).toBe('number')
      expect(result.current.annotations[0].sequence).toBe(1)
      expect(result.current.annotations[0].x).toBe(100)
      expect(result.current.annotations[0].y).toBe(200)
      expect(result.current.annotations[0].color).toBe('#F44336')

      act(() => {
        result.current.addAnnotation(300, 400)
      })
      expect(result.current.annotations).toHaveLength(2)
      expect(result.current.annotations[1].sequence).toBe(2)
    })

    it('默认颜色为红色', () => {
      const { result } = renderHook(() => useAnnotations())
      act(() => {
        result.current.addAnnotation(0, 0)
      })
      expect(result.current.annotations[0].color).toBe('#F44336')
    })

    it('支持自定义颜色', () => {
      const { result } = renderHook(() => useAnnotations('#2196F3'))
      act(() => {
        result.current.addAnnotation(0, 0)
      })
      expect(result.current.annotations[0].color).toBe('#2196F3')
    })
  })

  describe('文字标注模式', () => {
    it('切换到文字模式后点击应进入文字输入状态', () => {
      const { result } = renderHook(() => useAnnotations())

      act(() => {
        result.current.setToolMode('text')
      })
      act(() => {
        result.current.addAnnotation(50, 60)
      })

      expect(result.current.annotations).toHaveLength(0)
      expect(result.current.pendingText).toEqual({ x: 50, y: 60 })
    })

    it('提交文字后应创建文字标注', () => {
      const { result } = renderHook(() => useAnnotations())

      act(() => {
        result.current.setToolMode('text')
      })
      act(() => {
        result.current.addAnnotation(50, 60)
      })
      act(() => {
        result.current.commitText('标注内容')
      })

      expect(result.current.annotations).toHaveLength(1)
      expect(result.current.annotations[0].type).toBe('text')
      expect(result.current.annotations[0].text).toBe('标注内容')
      expect(result.current.pendingText).toBeNull()
    })

    it('空文字不创建标注', () => {
      const { result } = renderHook(() => useAnnotations())

      act(() => {
        result.current.setToolMode('text')
      })
      act(() => {
        result.current.addAnnotation(50, 60)
      })
      act(() => {
        result.current.commitText('   ')
      })

      expect(result.current.annotations).toHaveLength(0)
      expect(result.current.pendingText).toBeNull()
    })

    it('取消文字输入不创建标注', () => {
      const { result } = renderHook(() => useAnnotations())

      act(() => {
        result.current.setToolMode('text')
      })
      act(() => {
        result.current.addAnnotation(50, 60)
      })
      act(() => {
        result.current.cancelText()
      })

      expect(result.current.annotations).toHaveLength(0)
      expect(result.current.pendingText).toBeNull()
    })
  })

  describe('撤销和清除', () => {
    it('撤销应移除最后一个标注', () => {
      const { result } = renderHook(() => useAnnotations())

      act(() => result.current.addAnnotation(0, 0))
      act(() => result.current.addAnnotation(10, 10))
      expect(result.current.annotations).toHaveLength(2)

      act(() => result.current.undo())
      expect(result.current.annotations).toHaveLength(1)
      expect(result.current.annotations[0].sequence).toBe(1)
    })

    it('清除应移除所有标注', () => {
      const { result } = renderHook(() => useAnnotations())

      act(() => result.current.addAnnotation(0, 0))
      act(() => result.current.addAnnotation(10, 10))
      act(() => result.current.clearAll())
      expect(result.current.annotations).toHaveLength(0)
    })

    it('删除指定标注后序号继续递增', () => {
      const { result } = renderHook(() => useAnnotations())

      act(() => result.current.addAnnotation(0, 0))
      act(() => result.current.addAnnotation(10, 10))
      act(() => result.current.addAnnotation(20, 20))
      const idToRemove = result.current.annotations[1].id

      act(() => result.current.remove(idToRemove))
      expect(result.current.annotations).toHaveLength(2)

      // 再添加一个，序号应为 4（基于剩余最大序号 3 + 1）
      act(() => result.current.addAnnotation(30, 30))
      expect(result.current.annotations).toHaveLength(3)
      expect(result.current.annotations[2].sequence).toBe(4)
    })
  })
})
