import type { ComponentType } from 'react'
import type { SvgIconComponent } from '@mui/icons-material'
import ScreenshotMonitorIcon from '@mui/icons-material/ScreenshotMonitor'
import VideocamIcon from '@mui/icons-material/Videocam'
import PushPinIcon from '@mui/icons-material/PushPin'
import ColorizeIcon from '@mui/icons-material/Colorize'
import TaskAltIcon from '@mui/icons-material/TaskAlt'
import type { ShortcutAction } from '../services/shortcut.service'
import TodoView from '../views/TodoView'

/// 办公模块定义
export interface Module {
  /// 模块唯一标识
  id: string
  /// 显示名称
  label: string
  /// 类型：data=主窗口内容区视图；tool=独立浮动窗口
  type: 'data' | 'tool'
  /// MUI 图标
  icon: SvgIconComponent
  /// data 型模块的视图组件
  view?: ComponentType
  /// tool 型模块关联的窗口类型
  windowType?: string
  /// tool 型模块的快捷键动作
  shortcutAction?: ShortcutAction
}

/// 模块集中清单：新增模块在此追加一项即可
export const MODULES: Module[] = [
  {
    id: 'todo',
    label: '待办',
    type: 'data',
    icon: TaskAltIcon,
    view: TodoView,
  },
  {
    id: 'screenshot',
    label: '截图',
    type: 'tool',
    icon: ScreenshotMonitorIcon,
    windowType: 'capture',
    shortcutAction: 'screenshot',
  },
  {
    id: 'recorder',
    label: '录屏',
    type: 'tool',
    icon: VideocamIcon,
    windowType: 'recorder',
    shortcutAction: 'recorder',
  },
  {
    id: 'pin',
    label: '贴图',
    type: 'tool',
    icon: PushPinIcon,
    windowType: 'pin',
    shortcutAction: 'pin',
  },
  {
    id: 'color-picker',
    label: '取色',
    type: 'tool',
    icon: ColorizeIcon,
    windowType: 'color-picker',
    shortcutAction: 'color-picker',
  },
]

/// 数据型模块列表
export const getDataModules = (): Module[] => MODULES.filter((m) => m.type === 'data')

/// 工具型模块列表
export const getToolModules = (): Module[] => MODULES.filter((m) => m.type === 'tool')