import { useState, useEffect } from 'react'
import WorkspaceLayout from '../components/WorkspaceLayout'
import { getDataModules, getToolModules } from '../modules'
import type { Module } from '../modules'
import { createWindow } from '../services/window.service'
import {
  DEFAULT_SHORTCUTS,
  getShortcuts,
  getShortcutByAction,
} from '../services/shortcut.service'
import type { ShortcutConfig } from '../services/shortcut.service'
import SettingsView from './SettingsView'

/// 办公工作台主视图
export default function MainView() {
  const [config, setConfig] = useState<ShortcutConfig>(DEFAULT_SHORTCUTS)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [activeModuleId, setActiveModuleId] = useState<string>(
    getDataModules()[0]?.id ?? '',
  )

  const loadConfig = () => {
    getShortcuts()
      .then(setConfig)
      .catch(() => {
        /* 加载失败保持默认值 */
      })
  }

  useEffect(() => {
    loadConfig()
  }, [])

  const handleOpenTool = async (windowType: string) => {
    try {
      await createWindow(windowType)
    } catch (error) {
      console.error('创建窗口失败:', error)
    }
  }

  const handleSettingsClose = () => {
    setSettingsOpen(false)
    // 关闭设置后重新加载，让侧边栏快捷键提示同步更新
    loadConfig()
  }

  const shortcutOf = (m: Module): string =>
    m.shortcutAction ? getShortcutByAction(config, m.shortcutAction) : ''

  return (
    <>
      <WorkspaceLayout
        dataModules={getDataModules()}
        toolModules={getToolModules()}
        activeModuleId={activeModuleId}
        shortcutOf={shortcutOf}
        onSelectModule={setActiveModuleId}
        onOpenTool={handleOpenTool}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <SettingsView open={settingsOpen} onClose={handleSettingsClose} />
    </>
  )
}