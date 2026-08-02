import { describe, it, expect } from 'vitest'
import {
  createNumberAnnotation,
  createTextAnnotation,
  nextSequence,
} from './annotation'
import type { Annotation } from './annotation'

describe('annotation 模型', () => {
  describe('createNumberAnnotation', () => {
    it('应创建数字标注，序号正确', () => {
      const ann = createNumberAnnotation(100, 200, 1)
      expect(ann.type).toBe('number')
      expect(ann.x).toBe(100)
      expect(ann.y).toBe(200)
      expect(ann.sequence).toBe(1)
      expect(ann.color).toBe('#F44336')
      expect(ann.id).toBeTruthy()
    })

    it('应支持自定义颜色', () => {
      const ann = createNumberAnnotation(50, 50, 3, '#2196F3')
      expect(ann.color).toBe('#2196F3')
      expect(ann.sequence).toBe(3)
    })
  })

  describe('createTextAnnotation', () => {
    it('应创建文字标注，内容正确', () => {
      const ann = createTextAnnotation(100, 200, 'Hello')
      expect(ann.type).toBe('text')
      expect(ann.x).toBe(100)
      expect(ann.y).toBe(200)
      expect(ann.text).toBe('Hello')
      expect(ann.color).toBe('#F44336')
      expect(ann.id).toBeTruthy()
    })
  })

  describe('nextSequence', () => {
    it('空列表应返回 1', () => {
      expect(nextSequence([])).toBe(1)
    })

    it('应返回最大序号 + 1', () => {
      const annotations: Annotation[] = [
        createNumberAnnotation(0, 0, 1),
        createNumberAnnotation(10, 10, 3),
        createNumberAnnotation(20, 20, 2),
      ]
      expect(nextSequence(annotations)).toBe(4)
    })

    it('应忽略文字标注', () => {
      const annotations: Annotation[] = [
        createNumberAnnotation(0, 0, 1),
        createTextAnnotation(10, 10, 'text'),
      ]
      expect(nextSequence(annotations)).toBe(2)
    })
  })
})
