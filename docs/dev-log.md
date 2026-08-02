# SnapMaster 开发日志

## M1: 项目骨架初始化 (2026-08-02)

### 完成内容
- 配置 npm 淘宝镜像源 + cargo USTC 镜像源
- 初始化 Tauri 2.x + React 19 + TypeScript + Vite 8 项目
- 安装前端依赖：MUI v6、Zustand v5、React Router v7、@tauri-apps/api
- 安装测试依赖：Vitest v2、React Testing Library、jsdom
- 配置 Vitest + jsdom 测试环境（独立 vitest.config.ts）
- TDD: 编写 App 组件测试（Red → Green）
- 创建 Rust core 模块 + RgbColor 颜色转换（8 个单元测试）
- 安装 Linux 系统依赖（WebKitGTK 等）
- 验证四连全部通过：install → test → build
- 创建 docs 架构文档

### 验证结果
- npm test: 2 passed
- cargo test: 8 passed
- npm run build: 成功

### 关键决策
- 分离 vite.config.ts 和 vitest.config.ts，解决 Vite 8 与 Vitest 2 的类型冲突
- esbuild 配置 jsx: 'automatic' 解决 React 19 JSX 运行时问题
- 录屏方案确定：xcap + openh264 + muxide，纯 Rust 无 ffmpeg

## M2: 多窗口机制 + 主窗口基础 UI (2026-08-02)

### 完成内容
- 设计多窗口架构：主窗口预定义 + 子窗口动态创建
- 前端路由：通过 `?window=` 参数区分窗口类型，React Router 路由分发
- TDD: 8 个前端测试覆盖主窗口 + 截图浮层 + 录屏控制条 + 取色器视图
- 主窗口 UI：4 功能卡片布局（截图/录屏/贴图/取色），Material Design 风格
- Rust 端窗口管理：WindowConfig 模型 + 9 个单元测试
- Tauri commands: create_window / close_window / set_always_on_top
- 前端 service 封装: window.service.ts

### 验证结果
- npm test: 8 passed
- cargo test: 17 passed (8 color + 9 window_config)
- npm run build: 成功

### 架构设计
- 所有窗口共用 index.html 入口，通过 URL query 参数区分视图
- 主窗口在 tauri.conf.json 预定义，其他窗口由 Rust 端动态创建
- WindowConfig 封装各窗口类型的默认配置（尺寸/全屏/置顶/边框/可调整）

## M3: 交互式截图浮层 (2026-08-02)

### 完成内容
- TDD: 10 个测试覆盖截图浮层全流程（初始状态/拖拽选区/确认截图/取消截图）
- 实现鼠标拖拽选区：mousedown/mousemove/mouseup 事件链
- 实时选区预览框：支持正向和反向拖拽，自动计算左上角原点和尺寸
- 操作栏：确认（调用 captureRegion）/取消（清除选区）
- 截图结果展示：Base64 PNG data URL 渲染预览
- 错误处理：截图失败显示错误提示条

### 验证结果
- npm test: 23 passed (10 CaptureView + 8 App + 5 capture.service)
- npm run build: 成功

### 关键决策
- 选区框使用 pointerEvents: 'none'，避免遮挡鼠标事件
- 操作栏在选区右下方 8px 偏移显示
- 截图结果覆盖全屏展示，关闭后回到浮层可重新截图

## M4: 主窗口功能卡片点击联动 (2026-08-02)

### 完成内容
- TDD: 4个测试覆盖主窗口卡片点击（截图/录屏/贴图/取色）
- 实现 MainView 卡片点击事件，调用 createWindow 打开对应窗口
- 错误处理：捕获并记录窗口创建失败

### 验证结果
- npm test: 27 passed (4 MainView + 10 CaptureView + 8 App + 5 capture.service)
- npm run build: 成功

### 关键决策
- 使用 async/await 处理 createWindow 调用
- 错误通过 console.error 记录，不阻断用户交互
