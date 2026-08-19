# SnapMaster 项目分析

本文档基于仓库当前代码对项目进行整体分析，涵盖业务拆解、架构设计、核心数据流与模块划分。开发过程细节见 [dev-log.md](dev-log.md)，架构设计细节见 [architecture.md](architecture.md)。

## 1. 项目简介

SnapMaster 是一款基于 **Tauri 2** 的跨平台桌面截图工具，后端使用 Rust，前端使用 React + TypeScript + Vite。核心能力包括：**截图、录屏、贴图、取色** 四大功能，支持全局快捷键与用户自定义快捷键。

| 项 | 值 |
|----|----|
| 产品形态 | 桌面应用（Tauri 2） |
| 后端 | Rust（领域/服务/接口三层） |
| 前端 | React 19 + TypeScript + Vite 8 + MUI v6 |
| 状态管理 | Zustand v5（已引入） |
| 测试 | Vitest（前端）+ cargo test（后端） |
| 入口 | 主窗口 480×600，功能窗口动态创建 |

## 2. 业务分析

业务以**主窗口承载四个功能卡片 + 全局快捷键触发**为组织方式，各功能通过独立窗口运行。

### 2.1 四大业务模块

| 模块 | 入口 | 触发方式 | 核心能力 |
|------|------|----------|----------|
| 截图 screenshot | CaptureView | 卡片 / Ctrl+Shift+S | 全屏、选区截图、像素取色、标注、保存/复制/贴图 |
| 录屏 recorder | RecorderView | 卡片 / Ctrl+Shift+R | MP4（H.264 + Opus 系统音频）、GIF 录制 |
| 贴图 pin | PinView | 截图结果页 | 跨窗口贴图、拖动、缩放、复制/保存 |
| 取色 color-picker | ColorPickerView | 卡片 / Ctrl+Shift+C | 实时取色、放大镜、HEX/RGB 复制 |

### 2.2 功能能力矩阵

**截图模块**
- 全屏 / 鼠标拖拽选区截图，支持多显示器选择
- 结果页标注：数字圆圈、文字、4 色、撤销/清除，合成到图片
- 保存 PNG / 复制剪贴板 / 贴图到桌面

**录屏模块**
- 选区分三阶段交互：选区浮层 → 控制条（计时）→ 完成结果
- 两种输出格式：MP4（H.264 视频 + 可选 Opus 系统音频）、GIF（限宽 480px）
- 纯 Rust 实现，无 ffmpeg 外部依赖

**贴图模块**
- 图片常驻桌面，可拖动、右下角缩放手柄，悬停显示关闭
- 点击切换操作栏（复制/保存/取消）

**通用能力**
- 全局快捷键自定义（screenshot / recorder / pin / color-picker 四动作），持久化到 config.json
- 多显示器虚拟桌面坐标兼容

### 2.3 业务角色与使用流程

用户（终端个人用户）通过主窗口卡片或全局快捷键进入功能窗口完成"采集 → 加工 → 输出（保存/复制/贴图）"的闭环：

```
主窗口/快捷键 → 功能窗口 → 采集数据(Rust) → 前端加工 → 输出(保存/剪贴板/贴图)
```

## 3. 技术栈

| 层级 | 选型 | 版本 |
|------|------|------|
| 桌面框架 | Tauri | 2.x |
| 前端框架 | React + TypeScript + Vite | 19 / 5.x / 8.x |
| UI | MUI (Material UI) | v6 |
| 状态管理 | Zustand | v5 |
| 路由 | React Router | v7 |
| 前端测试 | Vitest + React Testing Library + jsdom | v2 |
| 截图/录屏采集 | xcap | 0.9 |
| H.264 编码 | openh264 | 0.7 |
| MP4 封装 | muxide | 0.2 |
| 音频编码 | opus crate | 0.3 |
| 系统音频采集 | cpal（optional `audio` feature） | 0.17 |
| GIF 编码 | gif crate | 0.14 |
| 图像处理 | image + imageproc | - |
| 全局热键 | tauri-plugin-global-shortcut | - |
| 剪贴板 | tauri-plugin-clipboard-manager + arboard | - |
| 配置持久化 | tauri-plugin-store | - |
| 后端测试 | cargo test + mockall | - |

## 4. 架构设计

### 4.1 前后端分层架构

后端（Rust）与前端（React）职责分离：Rust 负责系统调用与图像处理，React 负责 UI 交互，两者通过 Tauri Command（invoke）通信。

```
┌──────────────────────── 前端 (React) ───────────────────────┐
│  views (5 个视图)  components  services(invoke封装)  types   │
│  App.tsx 按 ?window= 参数路由分发多窗口                       │
└──────────────────────────┬───────────────────────────────────┘
                           │ Tauri invoke / 事件
┌────────────────────── 后端 (Rust) ──────────────────────────┐
│ commands/    接口层：capture / recorder / pin / shortcut /  │
│              storage / window                                 │
│ services/    服务层：业务编排、全局单例、快捷键注册、配置持久化 │
│ core/        领域层：纯业务模型（无外部依赖）                   │
└────────────────────────────────────────────────────────────────┘
```

### 4.2 多窗口机制（核心设计）

所有窗口共用同一个 `index.html` 入口，通过 URL query 参数 `?window=` 区分视图，`App.tsx` 内用 React Router 的 `useSearchParams` 分发：

- 主窗口在 `tauri.conf.json` 预定义（label: main）
- 功能窗口由 Rust 端 `create_window` 动态创建，`WindowConfig` 封装各窗口类型的默认配置（尺寸/全屏/置顶/边框/可调整）
- 快捷键触发时用时间戳后缀保证窗口 label 唯一，支持多次触发不冲突

### 4.3 关键设计决策

1. **TDD 驱动**：每个功能先写测试（Red）再实现（Green）
2. **面向接口**：模块间通过 Trait/接口通信，避免直接依赖
3. **纯 Rust 录屏**：xcap + openh264 + muxide，无 ffmpeg 强依赖
4. **可选音频 feature**：cpal 默认关闭（`--features audio` 启用），保持构建链轻量且测试不依赖音频设备
5. **图片跨窗口传递**：用 Rust 进程内内存缓存（pin_service stash/take），不用文件或 store
6. **全局快捷键配置化**：注册/注销/更新分发，先注册成功后持久化，失败不破坏原配置

## 5. 核心数据流

### 5.1 截图数据流（多屏兼容）

```
前端 listMonitors() → MonitorInfo[]
  单屏：隐藏下拉，直接全屏/选区截图
  多屏：下拉选择目标显示器（默认主显示器）
        ↓
captureFullscreen/captureRegion/capturePixel(monitorId?)
  → select_monitor 三级回退（精确 id → 主显示器 → 第一个）
  → monitor.capture_image() → PNG Base64 → 前端渲染
```

### 5.2 录屏数据流（MP4 / GIF 双路径）

```
MP4: xcap 逐帧 RGBA → 转偶尺寸 → rgba_to_i420(BT.601) → openh264 H.264
     + cpal 系统音频 → Opus 编码
     → muxide 封装 MP4（fast-start）
GIF: xcap 逐帧 RGBA → 最近邻降采样(≤480px) → GifEncoder 256 色量化
```

双路径由 `RecorderConfig.output_format` 决定，`run_recording` 分发。音频仅 `Mp4 + audioEnabled` 时启用，采集失败优雅降级为纯视频。

### 5.3 录屏状态机

```
Idle ──start──▶ Recording ──stop──▶ Stopped ──reset──▶ Idle
                  │
                  └──cancel──▶ Idle（不产生结果）
```

`RecorderService` 为全局单例，后台线程持有 `Arc<AtomicBool>` 停止标志，`sleep_with_flag` 每 10ms 检查，保证停止响应 <10ms；录制超 1 小时自动停止。

## 6. 目录结构

```
src/                            # React 前端
├── views/                      # 5 个窗口视图
├── components/                 # HotkeyRecorder 等复用组件
├── hooks/                      # useAnnotations 标注逻辑
├── services/                   # Tauri invoke 封装
├── types/                      # TS 类型定义
├── utils/                      # composeImage 画布合成
├── App.tsx                     # 多窗口路由分发
└── main.tsx                    # 入口 + MUI ThemeProvider

src-tauri/src/                  # Rust 后端
├── core/                       # 领域层（无外部依赖）
│   ├── color.rs                # RgbColor HEX/RGB 转换
│   ├── screenshot.rs           # MonitorInfo/选区模型 + contains_point
│   ├── recorder.rs             # RecorderConfig/状态机/色彩转换
│   ├── audio.rs                # OpusEncoder
│   ├── gif.rs                  # GifEncoder + 降采样
│   └── window_config.rs        # 窗口默认配置
├── services/                   # 服务层（业务编排/全局单例）
│   ├── capture_service.rs      # 截图/取色/list_monitors
│   ├── recorder_service.rs     # 后台录制线程
│   ├── pin_service.rs          # 贴图内存缓存
│   ├── storage_service.rs      # 保存/剪贴板
│   ├── shortcut_service.rs     # 全局快捷键注册/更新
│   └── shortcut_config.rs      # 快捷键配置持久化
├── commands/                   # 接口层（Tauri Commands）
└── lib.rs                      # 插件注册 + invoke_handler + setup
```

## 7. 测试与质量

| 环境 | 计数（当前） | 说明 |
|------|------|------|
| 前端 `npm test` | 188 passed（15 文件） | Vitest + RTL + jsdom |
| 后端 `cargo test` | 159 passed | 含 mockall |
| 构建 | `npm run build` / `cargo build` 均通过 | 含 `--features audio` |

测试覆盖：视图交互、services、核心模型、命令签名、色彩转换、录屏状态机、快捷键录制等。

## 8. 迭代阶段现状

| 阶段 | MVU | 状态 |
|------|-----|------|
| P0 | M1 项目骨架 / M2 多窗口机制 | ✅ |
| P1 | M3-M6 核心截图（浮层/交互/保存/标注） | ✅ |
| P2 | M7-M9 标注/快捷键/贴图 | ✅ |
| P3 | M10 取色器 | ✅ |
| P3 | M11 录屏基础（H.264+MP4） | ✅ |
| P3 | M12 录屏音频(GIF) | ✅ |
| P3 | M13 截图全屏 + 多屏兼容 | ✅ |
| P4 | M14-M15 增强功能 | 待开发 |
| P5 | M16-M18 完善 | 待开发 |