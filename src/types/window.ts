/// 窗口类型枚举
export type WindowType = 'main' | 'capture' | 'recorder' | 'color-picker' | 'pin'

/// 功能入口定义
export interface FeatureEntry {
  /// 功能标识
  id: string
  /// 显示名称
  label: string
  /// MUI 图标组件名
  icon: string
  /// 对应的窗口类型
  windowType: WindowType
  /// 快捷键描述
  shortcut: string
}
