import {
  Box,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
} from '@mui/material'
import SettingsIcon from '@mui/icons-material/Settings'
import type { Module } from '../modules'

export interface WorkspaceLayoutProps {
  dataModules: Module[]
  toolModules: Module[]
  activeModuleId: string
  shortcutOf: (module: Module) => string
  onSelectModule: (id: string) => void
  onOpenTool: (windowType: string) => void
  onOpenSettings: () => void
}

/// 办公工作台布局：左侧导航栏 + 右侧内容区
export default function WorkspaceLayout({
  dataModules,
  toolModules,
  activeModuleId,
  shortcutOf,
  onSelectModule,
  onOpenTool,
  onOpenSettings,
}: WorkspaceLayoutProps) {
  const activeModule =
    dataModules.find((m) => m.id === activeModuleId) ?? dataModules[0]
  const ActiveView = activeModule?.view

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      {/* 侧边栏导航 */}
      <Box
        component="nav"
        data-testid="workspace-sidebar"
        sx={{
          width: 200,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Toolbar variant="dense" data-testid="app-title">
          <Typography variant="h6" fontWeight="bold">
            SnapMaster
          </Typography>
        </Toolbar>
        <Divider />
        {/* 数据型模块（工作台视图） */}
        <List dense data-testid="data-module-list">
          {dataModules.map((m) => (
            <ListItemButton
              key={m.id}
              selected={m.id === activeModuleId}
              onClick={() => onSelectModule(m.id)}
              data-testid={`module-item-${m.id}`}
            >
              <ListItemIcon sx={{ minWidth: 32 }}>
                <m.icon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary={m.label} />
            </ListItemButton>
          ))}
        </List>
        <Divider />
        {/* 工具型模块（浮动窗口入口） */}
        <List dense data-testid="tool-module-list">
          {toolModules.map((m) => (
            <ListItemButton
              key={m.id}
              onClick={() => m.windowType && onOpenTool(m.windowType)}
              data-testid={`tool-item-${m.id}`}
            >
              <ListItemIcon sx={{ minWidth: 32 }}>
                <m.icon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={m.label}
                secondary={shortcutOf(m) || undefined}
              />
            </ListItemButton>
          ))}
        </List>
        <Box sx={{ flexGrow: 1 }} />
        <Divider />
        {/* 设置入口 */}
        <List dense>
          <ListItemButton onClick={onOpenSettings} data-testid="open-settings">
            <ListItemIcon sx={{ minWidth: 32 }}>
              <SettingsIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="设置" />
          </ListItemButton>
        </List>
      </Box>

      {/* 内容区：渲染选中的 data 型模块视图 */}
      <Box
        component="main"
        data-testid="workspace-content"
        sx={{ flexGrow: 1, p: 2, overflow: 'auto' }}
      >
        {ActiveView ? <ActiveView /> : null}
      </Box>
    </Box>
  )
}