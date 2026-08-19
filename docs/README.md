# SnapMaster 综合文档

SnapMaster 是一款基于 Tauri 2 的**综合办公桌面工作台**。后端 Rust，前端 React + TypeScript + Vite。在原有通用工具（**截图、录屏、贴图、取色**，支持全局快捷键）基础上，按**模块化设计**扩展办公数据型功能，首个办公模块为**待办事项**。

> 本文档由原 architecture.md、project-analysis.md、dev-log.md 合并而来。办公改造设计见[第 10 章](#10-办公项目改造设计待办)。

## 目录

- [1. 业务分析](#1-业务分析)
- [2. 技术栈](#2-技术栈)
- [3. 架构设计](#3-架构设计)
- [4. 截图数据流](#4-截图数据流多屏兼容)
- [5. 录屏数据流](#5-录屏数据流无-ffmpeg)
- [6. 目录结构](#6-目录结构)
- [7. 测试与质量](#7-测试与质量)
- [8. 迭代计划](#8-迭代计划)
- [9. 开发日志](#9-开发日志)
- [10. 办公项目改造设计（待办）](#10-办公项目改造设计待办)

---

## 1. 业务分析

### 1.1 项目简介

| 项 | 值 |
|----|----|
| 产品形态 | 桌面应用（Tauri 2） |
| 后端 | Rust（领域/服务/接口三层） |
| 前端 | React 19 + TypeScript + Vite 8 + MUI v6 |
| 状态管理 | Zustand v5 |
| 测试 | Vitest（前端）+ cargo test（后端） |
| 入口 | 主窗口 480×600，功能窗口动态创建 |

### 1.2 五大业务模块

| 模块 | 类型 | 入口 | 核心能力 |
|------|------|------|----------|
| 截图 screenshot | 工具型 | CaptureView（浮动窗）/ Ctrl+Shift+S | 全屏、选区截图、像素取色、标注、保存/复制/贴图 |
| 录屏 recorder | 工具型 | RecorderView（浮动窗）/ Ctrl+Shift+R | MP4（H.264 + Opus 系统音频）、GIF 录制 |
| 贴图 pin | 工具型 | 截图结果页 | 跨窗口贴图、拖动、缩放、复制/保存 |
| 取色 color-picker | 工具型 | ColorPickerView（浮动窗）/ Ctrl+Shift+C | 实时取色、放大镜、HEX/RGB 复制 |
| 待办 todo | 数据型 | 工作台内容区视图 | 新建/勾选/删改待办，状态筛选，持久化 |

### 1.3 功能能力矩阵

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

### 1.4 使用流程

```
主窗口/快捷键 → 功能窗口 → 采集数据(Rust) → 前端加工 → 输出(保存/剪贴板/贴图)
```

---

## 2. 技术栈

| 层级 | 选型 | 版本 |
|------|------|------|
| 桌面框架 | Tauri | 2.x |
| 前端框架 | React + TypeScript + Vite | 19 / 5.x / 8.x |
| UI 组件库 | MUI (Material UI) | v6 |
| 状态管理 | Zustand | v5 |
| 路由 | React Router | v7 |
| 前端测试 | Vitest + React Testing Library | v2 |
| Rust 截图 | xcap | 0.9 |
| Rust 录屏帧采集 | xcap (capture_image 逐帧) | 0.9 |
| H.264 编码 | openh264 | 0.7 |
| MP4 封装 | muxide | 0.2 |
| Opus 音频编码 | opus crate (libopus) | 0.3 |
| 系统音频采集 | cpal (ALSA/PulseAudio) | 0.17（optional `audio` feature） |
| GIF 编码 | gif crate | 0.14 |
| 图像处理 | image + imageproc | - |
| 全局热键 | tauri-plugin-global-shortcut | - |
| 剪贴板 | tauri-plugin-clipboard-manager + arboard | - |
| 配置持久化 | tauri-plugin-store | - |
| Rust 测试 | cargo test + mockall | - |

---

## 3. 架构设计

### 3.1 前后端分层架构

前后端职责分离：Rust 负责系统调用与图像处理，React 负责 UI 交互，通过 Tauri Command（invoke）通信。

```
src-tauri/                     # Rust 后端
├── src/
│   ├── core/                  # [领域层] 纯业务模型，无外部依赖
│   │   ├── mod.rs
│   │   ├── color.rs           # RgbColor: HEX/RGB 转换
│   │   ├── screenshot.rs      # CaptureRegion/ScreenshotResult/MonitorInfo + contains_point
│   │   ├── recorder.rs        # RecorderConfig/RecorderStateMachine + OutputFormat + rgba_to_i420
│   │   ├── audio.rs           # AudioConfig/AudioChannels/OpusEncoder + f32_to_i420
│   │   ├── gif.rs             # GifEncoder + downsample_rgba（最近邻缩放）
│   │   └── annotation.rs      # (后续) 标注模型
│   │
│   ├── platform/              # [抽象层] Trait 定义，可替换实现
│   │   ├── capture_trait.rs   # (后续) Capture trait
│   │   ├── recorder_trait.rs  # (后续) Recorder trait
│   │   └── hotkey_trait.rs    # (后续) Hotkey trait
│   │
│   ├── services/              # [服务层] 业务逻辑编排 + 全局单例
│   │   ├── capture_service.rs # 截图 + 像素取色 + list_monitors + 多屏选择
│   │   ├── recorder_service.rs# RecorderService 单例 + 后台录制线程
│   │   ├── annotation_service.rs # (后续) 标注合成
│   │   ├── storage_service.rs # 保存/剪贴板
│   │   ├── shortcut_config.rs # 快捷键配置模型 + store 持久化
│   │   ├── shortcut_service.rs # 全局快捷键注册/注销/更新
│   │   └── pin_service.rs     # 贴图数据内存缓存（stash/take）
│   │
│   ├── commands/              # [接口层] Tauri Commands
│   │   ├── capture_cmd.rs     # 截图/像素取色/list_monitors 命令（均支持 monitor_id）
│   │   ├── pin_cmd.rs         # 贴图数据暂存/取出命令
│   │   ├── recorder_cmd.rs    # 录屏 start/stop/cancel/state 命令
│   │   └── settings_cmd.rs    # (后续) 设置命令
│   │
│   └── main.rs                # 入口
│
src/                           # React 前端
├── views/                     # 5 个窗口视图
├── components/                # HotkeyRecorder 等可复用组件
├── hooks/                     # useAnnotations 标注逻辑
├── services/                  # Tauri invoke 封装
├── utils/                     # composeImage 画布合成
├── types/                     # TS 类型定义
├── App.tsx                    # 多窗口路由分发
├── main.tsx                   # 入口 + MUI ThemeProvider
└── test-setup.ts              # Vitest 测试 setup
```

### 3.2 多窗口机制

所有窗口共用同一个 `index.html` 入口，通过 URL query 参数 `?window=` 区分视图，`App.tsx` 内用 `useSearchParams` 分发：

- 主窗口在 `tauri.conf.json` 预定义（label: main）
- 功能窗口由 Rust 端 `create_window` 动态创建，`WindowConfig` 封装各窗口类型的默认配置（尺寸/全屏/置顶/边框/可调整）
- 快捷键触发时用时间戳后缀保证窗口 label 唯一，支持多次触发不冲突

### 3.3 设计原则

1. **前后端职责清晰**：Rust 负责系统调用和图像处理，React 负责 UI 交互
2. **面向接口编程**：platform 层定义 Trait，可替换底层实现
3. **TDD 开发**：每个功能先写测试（Red），再实现（Green），再重构（Refactor）
4. **低耦合高内聚**：模块间通过 Trait/接口通信，避免直接依赖

### 3.4 关键设计决策

1. **TDD 驱动**：每个功能先写测试再实现
2. **纯 Rust 录屏**：xcap + openh264 + muxide，无 ffmpeg 强依赖
3. **可选音频 feature**：cpal 默认关闭（`--features audio` 启用），保持构建链轻量且测试不依赖音频设备
4. **图片跨窗口传递**：用 Rust 进程内内存缓存（pin_service stash/take），不用文件或 store
5. **全局快捷键配置化**：注册/注销/更新分发，先注册成功后持久化，失败不破坏原配置

---

## 4. 截图数据流（多屏兼容）

```
[前端] listMonitors() → 获取所有显示器 MonitorInfo[]
   ├── 单屏：隐藏显示器下拉，直接全屏/选区截图
   └── 多屏：显示下拉，用户选目标显示器（默认主显示器）
            │
            ▼
[全屏截图] captureFullscreen(monitorId?)
   → select_monitor(id)：精确匹配 → 主显示器 → 第一个（三级回退）
   → monitor.capture_image() → PNG Base64 → ScreenshotResult

[选区截图] captureRegion(region, monitorId?)
   → select_monitor(id) → monitor.capture_region(x, y, w, h)
   → region 坐标以目标显示器左上角为原点

[像素取色] capturePixel(x, y, monitorId?)
   → select_monitor(id) → monitor.capture_image() → get_pixel(x, y)
```

多屏布局示例（虚拟桌面坐标）：
```
┌─────────────┐  ┌─────────────┐
│ Display 2   │  │ Display 1   │
│ x=-1920     │  │ x=0 (主)    │
│ y=0         │  │ y=0         │
│ 1920×1080   │  │ 1920×1080   │
└─────────────┘  └─────────────┘
```

---

## 5. 录屏数据流（无 ffmpeg）

### 5.1 MP4 路径（H.264 视频 + 可选 Opus 音频）

```
[视频] xcap 逐帧采集 RGBA
       → frame_to_even_rgba（裁剪到偶数尺寸）
       → rgba_to_i420（BT.601，Y/U/V 三平面）
       → i420_to_contiguous（拼成单 Vec）
       → openh264 Encoder 编码 H.264 (Annex B)
       → muxide Muxer.write_video(pts, bytes, is_key)
                                              ↓
[音频] cpal 输入流（PulseAudio/ALSA monitor）  ↓
       → 回调推送 f32 PCM 到 channel          ↓
       → 编码线程累积 960×2 样本/帧           ↓
       → OpusEncoder.encode → Opus 包         ↓
       → muxide Muxer.write_audio(pts, packet) ↓
                                              ↓
       muxide 封装 MP4（fast-start）→ 写入 ~/snapmaster_record_{ts}.mp4
```

音频为可选：`RecorderConfig.audioEnabled && outputFormat == Mp4` 时才启用。
muxide 要求音频 PTS 不能早于第一帧视频，故先写首帧视频再写音频。

### 5.2 GIF 路径（无音频）

```
xcap 逐帧采集 RGBA
  → downsample_rgba（最近邻缩放到 ≤480px 宽，等比）
  → GifEncoder.write_frame(rgba, delay_ms)
    （Frame::from_rgba_speed 自动量化 256 色调色板）
  → 写入 ~/snapmaster_record_{ts}.gif
```

GIF 限制：最大宽度 480px、录制时长 10 分钟（文件大小保护）。
两条路径互斥，由 `RecorderConfig.output_format` 决定，`run_recording` 分发。

### 5.3 录屏状态机

```
Idle ──start──▶ Recording ──stop──▶ Stopped ──reset──▶ Idle
                  │
                  └──cancel──▶ Idle（不产生结果）
```

- `RecorderService` 全局单例，跨 Tauri 命令保持会话状态
- 后台线程持有 `Arc<AtomicBool>` 停止标志，主线程设置后线程立即结束
- 错误通过 `Arc<Mutex<Option<String>>>` 传递回主线程
- 录制超过 1 小时自动停止（保护机制）

### 5.4 录屏窗口三阶段交互

```
[选区阶段] 全屏无边框遮罩
   ├── 拖拽选区 → 出现红色边框 + 工具栏（开始/取消）
   └── 点击顶部「全屏录屏」→ 直接开始全屏录制
            │
            ▼ startRecorder(config) + shrinkToControlBar()
[录制中阶段] 窗口缩小为 280×64 置顶控制条
   ├── 红点 + mm:ss 计时器（每 250ms 更新）
   └── 停止按钮 → stopRecorder()
            │
            ▼ 返回 MP4 路径
[完成阶段] 显示「已保存: <path>」，3 秒后自动关闭窗口
```

### 5.5 帧率与时间戳

- 默认 30 FPS，通过 `frame_interval_ms()` 计算帧间隔（1000/fps）
- `sleep_with_flag` 每 10ms 检查停止标志，保证停止响应 <10ms
- PTS 按固定步长 `1.0/fps` 递增，首帧标记为关键帧

---

## 6. 目录结构

```
项目根目录
├── docs/                      # 文档（本综合文档）
├── src/                       # React 前端
├── src-tauri/                 # Rust 后端
├── public/                    # favicon
├── package.json               # 前端依赖 + 脚本
├── vite.config.ts / vitest.config.ts
├── tsconfig*.json / .oxlintrc.json
└── index.html
```

> service/core/commands 细分子目录见 [3.1 分层架构](#31-前后端分层架构)。

---

## 7. 测试与质量

| 环境 | 计数 | 说明 |
|------|------|------|
| 前端 `npm test` | 188 passed（15 文件） | Vitest + RTL + jsdom |
| 后端 `cargo test` | 159 passed | 含 mockall |
| 构建 | `npm run build` / `cargo build` 通过 | 含 `--features audio` |

测试覆盖：视图交互、services、核心模型、命令签名、色彩转换、录屏状态机、快捷键录制等。

---

## 8. 迭代计划

| 阶段 | MVU | 状态 |
|------|-----|------|
| P0 | M1: 项目骨架 | ✅ 完成 |
| P0 | M2: 多窗口机制 | ✅ 完成 |
| P1 | M3-M6: 核心截图 | ✅ 完成 |
| P2 | M7-M9: 标注/快捷键/贴图 | ✅ 完成 |
| P3 | M10: 取色器 | ✅ 完成 |
| P3 | M11: 录屏基础（全屏+选区，H.264+MP4） | ✅ 完成 |
| P3 | M12: 录屏音频（Opus）+ GIF 录制 | ✅ 完成 |
| P3 | M13: 截图全屏选项 + 多屏兼容 | ✅ 完成 |
| P4 | M14-M15: 增强功能 | 待开发 |
| P5 | M16-M18: 完善 | 待开发 |
| O1 | T1: 工作台骨架（侧边栏 + 模块清单） | 待开发 |
| O1 | T2: 待办后端 CRUD + 前端列表/新建 | 待开发 |
| O1 | T3: 待办完整交互（勾选/删除/筛选） | 待开发 |

---

## 9. 开发日志

### M1: 项目骨架初始化

**完成内容**
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

**验证结果**
- npm test: 2 passed
- cargo test: 8 passed
- npm run build: 成功

**关键决策**
- 分离 vite.config.ts 和 vitest.config.ts，解决 Vite 8 与 Vitest 2 的类型冲突
- esbuild 配置 jsx: 'automatic' 解决 React 19 JSX 运行时问题
- 录屏方案确定：xcap + openh264 + muxide，纯 Rust 无 ffmpeg

### M2: 多窗口机制 + 主窗口基础 UI

**完成内容**
- 设计多窗口架构：主窗口预定义 + 子窗口动态创建
- 前端路由：通过 `?window=` 参数区分窗口类型，React Router 路由分发
- TDD: 8 个前端测试覆盖主窗口 + 截图浮层 + 录屏控制条 + 取色器视图
- 主窗口 UI：4 功能卡片布局（截图/录屏/贴图/取色），Material Design 风格
- Rust 端窗口管理：WindowConfig 模型 + 9 个单元测试
- Tauri commands: create_window / close_window / set_always_on_top
- 前端 service 封装: window.service.ts

**验证结果**
- npm test: 8 passed
- cargo test: 17 passed (8 color + 9 window_config)
- npm run build: 成功

**架构设计**
- 所有窗口共用 index.html 入口，通过 URL query 参数区分视图
- 主窗口在 tauri.conf.json 预定义，其他窗口由 Rust 端动态创建
- WindowConfig 封装各窗口类型的默认配置（尺寸/全屏/置顶/边框/可调整）

### M3: 交互式截图浮层

**完成内容**
- TDD: 10 个测试覆盖截图浮层全流程（初始状态/拖拽选区/确认截图/取消截图）
- 实现鼠标拖拽选区：mousedown/mousemove/mouseup 事件链
- 实时选区预览框：支持正向和反向拖拽，自动计算左上角原点和尺寸
- 操作栏：确认（调用 captureRegion）/取消（清除选区）
- 截图结果展示：Base64 PNG data URL 渲染预览
- 错误处理：截图失败显示错误提示条

**验证结果**
- npm test: 23 passed (10 CaptureView + 8 App + 5 capture.service)
- npm run build: 成功

**关键决策**
- 选区框使用 pointerEvents: 'none'，避免遮挡鼠标事件
- 操作栏在选区右下方 8px 偏移显示
- 截图结果覆盖全屏展示，关闭后回到浮层可重新截图

### M4: 主窗口功能卡片点击联动

**完成内容**
- TDD: 4 个测试覆盖主窗口卡片点击（截图/录屏/贴图/取色）
- 实现 MainView 卡片点击事件，调用 createWindow 打开对应窗口
- 错误处理：捕获并记录窗口创建失败

**验证结果**
- npm test: 27 passed (4 MainView + 10 CaptureView + 8 App + 5 capture.service)
- npm run build: 成功

**关键决策**
- 使用 async/await 处理 createWindow 调用
- 错误通过 console.error 记录，不阻断用户交互

### M5: 截图结果保存/复制到剪贴板

**完成内容**
- Rust: 添加 arboard 依赖，创建 StorageService 服务
- Rust: save_to_file 命令：Base64 解码后保存到用户 home 目录
- Rust: copy_to_clipboard 命令：Base64 → PNG → RGBA → 系统剪贴板
- Rust: 3 个单元测试 + 2 个命令签名测试
- 前端: capture.service.ts 添加 saveToFile / copyToClipboard 封装
- TDD: 4 个前端测试覆盖保存/复制按钮交互
- CaptureView 结果页：保存/复制/关闭按钮 + 状态提示

**验证结果**
- npm test: 33 passed (14 CaptureView + 4 MainView + 8 App + 7 capture.service)
- cargo test: 34 passed
- npm run build: 成功

**关键决策**
- arboard 3.4 用于跨平台剪贴板操作
- 保存到用户 home 目录，文件名格式 snapmaster_{timestamp}.png
- 保存/复制操作通过 setTimeout 3 秒后自动清除提示消息

### M6: 截图标注工具

**完成内容**
- 标注数据模型 types/annotation.ts：Annotation 类型 + 工厂函数 + 序号计算（6 个测试）
- useAnnotations hook：数字/文字标注增删撤销、工具模式切换、颜色选择（11 个测试）
- CaptureView 结果页集成标注功能：
  - 默认数字模式：点击图片放置红色数字圆圈，从1递增
  - 文字模式：点击后弹出输入框，Enter 确认/Esc 取消
  - 颜色选择：红/蓝/绿/橙 4 色
  - 撤销/清除全部
- SVG 覆盖层渲染标注，不影响图片交互
- TDD: 7 个 CaptureView 标注交互测试

**验证结果**
- npm test: 59 passed
- npm run build: 成功

**关键决策**
- SVG 覆盖层使用 pointerEvents: 'none'，点击事件由 img 元素处理
- 数字圆圈半径 20px，白色描边 2px
- 文字标注用矩形背景 + 文字，宽度根据文字长度计算
- 默认红色 #F44336，符合需求

### M6.1: 标注合成到图片

**完成内容**
- 创建 composeImage 工具函数：Canvas 绘制原图 + 标注 → 返回 data URL
- 数字标注：Canvas arc 圆圈 + fillText 数字
- 文字标注：fillRect 背景 + fillText 文字
- CaptureView 保存/复制时先调用 composeImage 合成标注，再传给后端
- TDD: 7 个 composeImage 测试 + 2 个更新测试

**验证结果**
- npm test: 66 passed
- npm run build: 成功

**关键决策**
- composeImage 使用 Canvas 2D API，与 SVG 渲染逻辑保持一致
- 合成后提取 Base64（去掉 data URL 前缀），传给后端 saveToFile / copyToClipboard
- 无标注时 composeImage 仍然执行（drawImage + toDataURL），保持统一路径

### M7: 全局快捷键触发截图

**完成内容**
- Rust: 添加 tauri-plugin-global-shortcut 依赖
- Rust: shortcut_service 模块，注册 Ctrl+Shift+S 全局快捷键
  - register_shortcuts: 解析快捷键 + on_shortcut 回调
  - open_capture_window: 快捷键按下时创建全屏无边框截图窗口（带唯一 label）
  - 2 个单元测试（常量值 + 时间戳）
- Rust: lib.rs 注册 global-shortcut 插件，setup 中调用 register_shortcuts
- 前端: shortcut.service.ts 常量服务（CAPTURE_SHORTCUT + parseShortcut + getCaptureShortcutDisplay）
- TDD: 6 个 shortcut.service 测试
- 主窗口: MainView 截图卡片快捷键提示改用常量（原硬编码 Ctrl+Shift+A → Ctrl+Shift+S）
- TDD: 1 个 MainView 快捷键提示测试

**验证结果**
- npm test: 73 passed
- cargo test: 36 passed
- npm run build: 成功

**关键决策**
- 快捷键注册放在 Rust 端 setup 中，应用启动即生效，无需前端触发
- CAPTURE_SHORTCUT 常量前后端共用同一值，避免不一致
- 截图窗口 label 用时间戳后缀保证唯一，支持多次触发不冲突
- on_shortcut 仅响应 Pressed 状态，避免释放时重复触发

### M8: 快捷键用户自定义

**完成内容**
- Rust: tauri-plugin-store 依赖，配置持久化到 config.json
- Rust: shortcut_config 模块（ShortcutAction 枚举 + ShortcutConfig 配置）
  - 默认值：screenshot=Ctrl+Shift+S / recorder=Ctrl+Shift+R / pin=Ctrl+Shift+P / color-picker=Ctrl+Shift+C
  - load/save 读写 store，缺失字段回退默认值
  - 10 个单元测试
- Rust: shortcut_service 重构为多快捷键动态注册/注销
  - register_one / unregister_one / register_all / update_shortcut
  - 4 个动作各自打开对应窗口（复用 WindowConfig）
  - 4 个单元测试
- Rust: shortcut_cmd 命令层
  - get_shortcuts: 返回当前配置
  - update_shortcut: 注销旧+注册新+持久化（先注册成功再保存，失败不破坏配置）
  - 2 个签名测试
- Rust: lib.rs 注册 store 插件，setup 加载配置并 register_all
- 前端: shortcut.service 扩展
  - ShortcutAction/ShortcutConfig 类型 + DEFAULT_SHORTCUTS 默认值
  - getShortcuts / updateShortcut / getShortcutByAction
  - 9 个测试
- 前端: HotkeyRecorder 录制式捕获组件
  - 点击进入录制，监听 window keydown 捕获组合键
  - normalizeKey/formatShortcut 工具函数（修饰键顺序 Ctrl+Shift+Alt+Super）
  - 至少一个修饰键、Esc 取消、纯修饰键忽略
  - 19 个测试
- 前端: SettingsView 设置弹窗
  - 4 个功能项 + HotkeyRecorder，加载配置/捕获后更新/错误提示
  - 9 个测试
- 主窗口: MainView 加齿轮入口 + Dialog，卡片快捷键提示从配置动态读取
  - 设置关闭后重新加载配置同步更新卡片
  - 10 个测试

**验证结果**
- npm test: 109 passed (10 test files)
- cargo test: 50 passed
- npm run build: 成功

**关键决策**
- 持久化用 tauri-plugin-store 官方插件，配置存 config.json 的 "shortcuts" key
- 更新快捷键时先注册新值成功再持久化，注册失败保持原配置不破坏
- 录制式捕获：按下组合键自动识别，强制至少一个修饰键避免单键冲突
- 修饰键固定顺序 Ctrl+Shift+Alt+Super，与 Tauri Shortcut 解析一致
- MainView 卡片快捷键从后端配置动态读取，设置变更后同步刷新
- ShortcutConfig 字段 color-picker 用 kebab-case 序列化，与 action 标识一致

### M9: 贴图功能

**完成内容**
- Rust: pin_service 内存缓存（全局 Mutex<HashMap>）
  - stash(label, data_url) / take(label) 取后即删 / clear
  - 6 个单元测试
- Rust: pin_cmd 命令层 stash_pin_image / take_pin_image（2 个签名 + 2 个行为测试）
- Rust: lib.rs 注册 pin 命令
- 前端: pin.service（pinImage 先暂存再建窗 / takePinImage / closePinWindow）
  - label 生成：前端 suffix=时间戳，Rust with_unique_label 拼 pin-{suffix}，stash 用完整 label 保证一致
  - 8 个测试
- CaptureView 结果页加"贴图"按钮：合成标注后调用 pinImage（3 个测试）
- 前端: PinView 贴图视图
  - 启动 takePinImage(label) 加载数据，loading/error 状态
  - 拖动移动：鼠标按下图片调用 win.startDragging()
  - 右下角自定义缩放手柄：拖拽计算新尺寸 → win.setSize(LogicalSize)，最小 80x60
  - 悬停显示关闭按钮
  - Esc 关闭窗口
  - 单击图片切换操作栏（复制/保存为文件/取消）
  - 复制/保存从 dataUrl 提取 base64 调用后端
  - 19 个测试
- App 路由加 ?window=pin → PinView（1 个测试）

**验证结果**
- npm test: 140 passed (12 test files)
- cargo test: 60 passed
- npm run build: 成功

**关键决策**
- 图片跨窗口传递用 Rust 内存缓存（同进程共享），不用文件/store，简单高效
- stash 用前端生成的完整 label（pin-{ts}）作 key，createWindow 传 suffix，Rust 拼出相同 label，保证取数据 key 一致
- 先 stash 再 createWindow，避免窗口加载时数据未就绪
- 调整大小用自定义右下角手柄 + setSize(LogicalSize)，不依赖系统缩放，体验一致
- 窗口尺寸下限 80x60，防止缩到不可见
- 贴图入口仅在截图结果页，符合主流程，避免过度设计

### M10: 取色器功能

**完成内容**
- Rust: core/color.rs RgbColor 模型（to_hex/to_rgb_string/from_hex，8 个测试）
- Rust: capture_service 加 capture_pixel(x,y) 截屏读像素 RGBA → RGB
  - 复用 primary_monitor 抽取主显示器查找逻辑
  - 坐标越界/负数校验
- Rust: capture_cmd 加 capture_pixel 命令（负数拒绝 + 签名测试）
- Rust: window_config ColorPicker 改为全屏无边框（透明遮罩预览模式）
- 前端: color.service（capturePixel/toHex/toRgbString/copyText）
  - copyText 优先 navigator.clipboard，失败回退 execCommand
  - 6 个测试
- 前端: ColorPickerView 全屏取色器
  - 鼠标移动节流取色（60ms），调用 capturePixel(screenX, screenY)
  - 放大镜跟随鼠标：颜色预览块 + HEX/RGB 色值
  - 点击采集：复制 HEX 到剪贴板 → 300ms 后关闭窗口
  - Esc 取消关闭
  - 顶部提示「点击采集 · Esc 取消」
  - 14 个测试
- App.test 补 color.service / window.service mock

**验证结果**
- npm test: 160 passed (14 test files)
- cargo test: 61 passed
- npm run build: 成功

**关键决策**
- 取色器窗口改为全屏透明遮罩（rgba(0,0,0,0.01)），与截图窗口模式一致，鼠标移动实时预览
- 取色用 screenX/screenY 屏幕坐标（非 clientX），因为 capture_pixel 截的是主显示器全屏
- 节流 60ms 避免高频截图取色拖慢性能
- 复制用浏览器 Clipboard API，失败回退 execCommand，不依赖后端 base64 接口
- 点击采集后延时 300ms 关闭，让用户看到「已复制」提示
- RgbColor 放 core 层纯模型，to_hex 大写格式，from_hex 支持可选 # 和大小写

### M11: 录屏基础（全屏 + 选区，H.264 + MP4）

**完成内容**
- Rust: core/recorder.rs 录屏领域模型
  - RecorderMode（Fullscreen/Region）+ RecorderState（Idle/Recording/Stopped）
  - RecorderConfig（fps + mode + region）+ is_valid + frame_interval_ms
  - RecorderStateMachine 状态机（start/stop/cancel/reset，非法转换报错）
  - rgba_to_i420：BT.601 整数近似（×256），Y/U/V 三平面，2x2 色度采样
  - i420_to_contiguous：三平面拼接为单 Vec（供 openh264 YUVBuffer::from_vec）
  - 28 个单元测试（配置/状态机/serde/色彩转换）
- Rust: services/recorder_service.rs 录屏服务
  - RecorderService 全局单例（Mutex<Option<ActiveRecording>>）
  - start/stop/cancel/state/reset/config 接口
  - 后台线程：xcap 逐帧采集 → frame_to_even_rgba → rgba_to_i420 → openh264 编码 → muxide 封装 MP4
  - Arc<AtomicBool> 停止标志 + Arc<Mutex<Option<String>>> 错误槽
  - sleep_with_flag 每 10ms 检查停止标志，保证停止响应 <10ms
  - 录制超过 1 小时自动停止（保护机制）
  - 输出路径：~/snapmaster_record_{ts}.mp4
  - 13 个单元测试
- Rust: commands/recorder_cmd.rs 命令层
  - start_recorder / stop_recorder / cancel_recorder / recorder_state
  - 4 个签名测试
- Rust: Cargo.toml 添加 openh264 0.7（source feature）+ muxide 0.2
- Rust: lib.rs 注册 RecorderService 单例 + 4 个录屏命令
- Rust: window_config.rs Recorder 窗口改为全屏无边框可调整（选区阶段全屏，录制阶段前端动态缩小）
- 前端: services/recorder.service.ts
  - RecorderMode/RecorderState/RecorderConfig 类型（与 Rust 一致，camelCase）
  - fullscreenConfig / regionConfig 工厂 + startRecorder/stopRecorder/cancelRecorder/recorderState
  - 11 个测试
- 前端: views/RecorderView.tsx 三阶段交互
  - 选区阶段：全屏遮罩 + 拖拽选区（复用 regionFromPoints）+ 顶部「全屏录屏」入口
  - 录制中阶段：窗口缩小为 280×64 置顶控制条（红点 + mm:ss 计时器 + 停止按钮）
  - 完成阶段：显示「已保存: <path>」，3 秒后自动关闭窗口
  - shrinkToControlBar：setFullscreen(false) + setSize + setAlwaysOnTop(true)
  - Esc：选区阶段取消，录制阶段停止
  - 错误处理：录制失败回退到选区阶段并恢复全屏
- 前端: App.test.tsx 录屏窗口测试（初始为选区浮层 + 全屏录屏入口）
- 主窗口: MainView 录屏卡片（VideocamIcon + Ctrl+Shift+R 快捷键提示，从配置动态读取）
- 快捷键: Ctrl+Shift+R 全局触发 → 打开 Recorder 窗口（shortcut_service 已映射 Recorder→Recorder）

**验证结果**
- npm test: 172 passed (15 test files)
- cargo test: 110 passed
- npm run build: 成功

**关键决策**
- 色彩转换用 BT.601 整数近似（77/150/29 系数 ×256 后 >>8），避免浮点运算
- Y/U/V 三平面拼接为单 Vec 再交给 YUVBuffer::from_vec，避免逐行拷贝
- frame_to_even_rgba 裁剪到偶数尺寸（YUV420 要求），奇数尺寸按行截断
- 录屏窗口初始全屏无边框可调整，录制开始时前端动态缩小为控制条，复用截图选区交互
- 后台线程 + AtomicBool 停止标志，主线程 stop 时 join 等待线程结束再返回路径
- PTS 按固定步长 1.0/fps 递增，首帧标记为关键帧，保证 MP4 可拖动播放
- 音频和 GIF 留到下一轮（M12），本轮仅视频轨道

### M12: 录屏音频（Opus）+ GIF 录制

**完成内容**
- Rust: core/audio.rs 音频领域模型
  - AudioConfig（sample_rate/channels）+ AudioChannels（Mono/Stereo）
  - OpusEncoder 封装 opus crate（Application::Audio，20ms 帧 = sample_rate/50 样本）
  - f32_to_i16 PCM 转换（[-1.0,1.0] → i16，clamp 保护）
  - 16 个单元测试
- Rust: core/gif.rs GIF 编码工具
  - GifEncoder<W: Write> 包装 gif::Encoder，set_repeat(Infinite)
  - write_frame(rgba, delay_ms)：Frame::from_rgba_speed 自动量化 256 色调色板
  - downsample_rgba：最近邻插值等比缩放到目标宽度
  - 12 个单元测试
- Rust: core/recorder.rs 扩展
  - OutputFormat 枚举（Mp4/Gif）+ Default::Mp4
  - RecorderConfig 新增 output_format（serde default）+ audio_enabled（serde default）
  - effective_audio()：仅 Mp4+audio_enabled 时为真；extension() 返回文件扩展名
  - 向后兼容：旧 JSON 不带新字段时回退默认值
  - 7 个新测试
- Rust: services/recorder_service.rs 双路径录制
  - run_recording 按 output_format 分发到 run_mp4_recording / run_gif_recording
  - run_mp4_recording：muxer 配置可选 .audio(AudioCodec::Opus, 48000, 2)
  - 音频采集线程 spawn_audio_capture（#[cfg(feature="audio")]）：
    cpal 输入流 → 回调推送 f32 PCM 到 channel → 编码线程累积 960×2 样本 → Opus 编码 → 发送
    沙箱/无设备环境优雅退出，主线程不收到音频包（降级为纯视频）
  - 主线程非阻塞 try_recv 音频包，write_audio(pts=count×0.02)
  - muxide 要求音频 PTS ≥ 首帧视频 PTS，故先写首帧视频再写音频
  - run_gif_recording：xcap 采集 → downsample_rgba(≤480px) → GifEncoder 逐帧写
  - GIF 限制：480px 最大宽度 + 10 分钟录制时长（文件大小保护）
  - generate_output_path 按 config.extension() 决定 .mp4/.gif
- Rust: Cargo.toml 添加 gif 0.14 / opus 0.3（默认）+ cpal 0.17（optional `audio` feature）
  - 默认构建不依赖 cpal/alsa-dev，保持轻量；真实环境 `--features audio` 启用系统音频
  - 安装 libasound2-dev + libopus-dev 系统依赖
- 前端: services/recorder.service.ts
  - OutputFormat 类型 + RecorderConfig 新增 outputFormat?/audioEnabled?
  - fullscreenConfig/regionConfig 增加 opts 参数（outputFormat/audioEnabled）
  - 4 个新测试
- 前端: views/RecorderView.tsx 选区阶段格式选择 UI
  - 顶部工具栏增加 ToggleButtonGroup（MP4/GIF）+ 音频开关 IconButton
  - GIF 模式禁用音频开关（Tooltip 提示"GIF 不支持音频"）
  - handleStart 把 outputFormat + audioEnabled 传入 config
- 文档: 录屏数据流（MP4 音频混流 + GIF 路径）、依赖表、目录结构、迭代计划

**验证结果**
- npm test: 176 passed (15 test files)
- cargo test: 145 passed（默认 feature）
- cargo build --features audio: 成功（cpal + opus 编译通过）
- npm run build: 成功

**关键决策**
- 音频采集做成 optional `audio` feature：默认构建链不引入 cpal/alsa-dev，CI/沙箱测试用默认 feature；真实环境 `--features audio` 启用系统音频采集
- Opus 编码始终启用（opus crate 默认依赖，libopus 已装）：编码逻辑可单元测试，不依赖设备
- 音频 PTS 用包计数 × 0.02s 累加，配合 muxide 的"音频不早于首帧视频"约束：先写首帧视频再写音频
- 音频采集失败优雅降级：cpal 找不到设备/建流失败时线程退出，主线程 try_recv 无包，录制继续为纯视频，不阻断
- GIF 用 Frame::from_rgba_speed 自动量化调色板（speed=10 平衡质量与速度），避免手写调色板量化
- GIF 降采样最近邻插值：简单快速，480px 限宽控制文件大小
- OutputFormat/audio_enabled 字段加 #[serde(default)]：保证旧前端请求向后兼容
- muxide write_audio 接受 Opus 包（已编码），不是 PCM；编码在音频线程完成
- 用户确认范围：仅系统音频 + Opus 编码 + 录屏转 GIF（非截图转 GIF）

### M13: 截图全屏选项 + 多屏兼容

**完成内容**
- Rust: core/screenshot.rs 新增 MonitorInfo 模型
  - 字段：id/name/x/y/width/height/isPrimary（虚拟桌面坐标 + 物理像素分辨率）
  - contains_point(px, py)：判断虚拟桌面坐标是否落在该显示器范围
  - 5 个单元测试（构造/包含判断/副屏场景/serde camelCase）
- Rust: services/capture_service.rs 重构多屏支持
  - list_monitors()：返回所有显示器 MonitorInfo 列表（单显示器信息获取失败时跳过）
  - select_monitor(monitor_id)：三级回退策略
    1. 按指定 id 精确匹配
    2. None 或找不到 id 时回退主显示器
    3. 仍找不到时回退第一个显示器
  - capture_fullscreen/capture_region/capture_pixel 全部增加 monitor_id: Option<u32> 参数
  - 5 个单元测试（invalid region/negative coords/list_monitors/monitor_count 一致性）
- Rust: commands/capture_cmd.rs 命令层扩展
  - capture_fullscreen(monitor_id) / capture_region(region, monitor_id) / capture_pixel(x, y, monitor_id)
  - 新增 list_monitors 命令
  - 8 个签名/参数测试
- Rust: lib.rs 注册 list_monitors 命令
- 前端: types/capture.ts 新增 MonitorInfo 接口 + monitorContainsPoint 工具函数
- 前端: services/capture.service.ts 扩展
  - captureFullscreen(monitorId?) / captureRegion(region, monitorId?)：可选参，不传时传 null
  - listMonitors()：返回 MonitorInfo[]
  - 11 个测试（含 monitorId 透传、listMonitors 成功/失败）
- 前端: views/CaptureView.tsx 顶部工具栏
  - 全屏截图按钮（FullscreenIcon + loading 状态）
  - 显示器选择下拉（多屏时显示，单屏隐藏；显示名称 + 分辨率 + 虚拟桌面坐标）
  - 默认选中主显示器；切换显示器时清除当前选区
  - handleConfirm 透传 monitorId；handleFullscreenCapture 一键采集选中显示器
  - 顶部工具栏 onMouseDown stopPropagation，避免误触发选区
- 前端: views/CaptureView.test.tsx 新增测试
  - 顶部工具栏/全屏按钮/单屏不显示下拉
  - 全屏截图成功/失败/进入结果页
  - 多屏场景显示下拉
  - 确认截图传 monitorId=undefined（单屏场景）

**验证结果**
- npm test: 188 passed (15 test files)
- cargo test: 159 passed
- npm run build: 成功

**关键决策**
- monitor_id 用 Option<u32>：None 时回退主显示器，保证旧调用方向后兼容
- select_monitor 三级回退：精确 id → 主显示器 → 第一个，保证任何环境下都能拿到显示器
- MonitorInfo.contains_point 用于未来按选区坐标自动定位显示器（当前版本由用户手动选）
- 单屏场景隐藏显示器下拉，避免 UI 干扰；多屏场景才显示
- 截图窗口仍单屏全屏（在主显示器），多屏选区由用户主动选择目标显示器
- 顶部工具栏 onMouseDown stopPropagation：点击工具栏不触发底层选区拖拽
- 切换显示器时清除选区：避免选区坐标与新显示器不匹配

---

## 10. 办公项目改造设计（待办）

> 讨论结论：将 SnapMaster 升级为**综合办公桌面工作台**，按模块化设计承载「工具型」与「数据型」两类功能。首个办公数据型模块为**待办事项**。

### 10.1 整体架构：工作台 + 工具模块

```
┌───────────────────────────────────────────────┐
│ 主窗口 = 工作台                                 │
│ ┌──────────┬────────────────────────────────┐ │
│ │ 侧边栏    │ 内容区（按选中模块渲染）           │ │
│ │ SnapMaster│                                │ │
│ │ ─────────│   [待办] 列表 / 过滤 / 新建      │ │
│ │ 📌 待办   │                                │ │
│ │ ⚙️ 设置   │                                │ │
│ │ ─────────│  (工具型在窗口外触发)            │ │
│ │ ✂ 截图 / 录屏 / 贴图 / 取色                │ │
│ └──────────┴────────────────────────────────┘ │
└───────────────────────────────────────────────┘
```

- **数据型模块**（如待办）：在主窗口内容区以视图渲染，常驻，共享持久化层
- **工具型模块**（截图/录屏/贴图/取色）：保留现有独立浮动窗口机制，侧边栏仅作入口触发

### 10.2 模块注册机制（前端集中清单）

```ts
interface Module {
  id: 'todo' | 'screenshot' | 'recorder' | 'pin' | 'color-picker';
  label: string;
  icon: ReactNode;
  type: 'data' | 'tool';      // 数据型=主窗口视图；工具型=浮动窗口
  view?: React.ComponentType; // 数据型提供视图
  windowType?: string;        // 工具型关联窗口类型
}
```

- `App.tsx` 现有 `?window=` 分发**保留**，专用于工具型浮动窗口
- 主窗口用内部状态渲染数据型模块视图，`Sidebar` 从单个 `modules` 清单生成导航项
- 新增模块 = 清单加一项 + 对应视图/命令，不改主框架

### 10.3 Rust 端分模块

待办模块依循既有的 core → services → commands 三层：
- `core/todo.rs`（模型 + 校验）
- `services/todo_service.rs`（SQLite CRUD）
- `commands/todo_cmd.rs`（命令）
- `lib.rs` 注册 `tauri-plugin-sql` 插件 + todo 命令

### 10.4 待办数据设计

```sql
CREATE TABLE IF NOT EXISTS todos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT    NOT NULL,
  done       INTEGER NOT NULL DEFAULT 0,
  priority   INTEGER NOT NULL DEFAULT 0,   -- 0低/1中/2高
  due_date   TEXT,                          -- 可选，YYYY-MM-DD
  created_at TEXT    NOT NULL,
  updated_at TEXT    NOT NULL
);
```

命令：`list_todos` / `create_todo` / `update_todo` / `delete_todo` / `toggle_todo`

### 10.5 待办视图交互（初版）

- 状态筛选 Tab：全部 / 进行中 / 已完成
- 新建：顶部输入框回车创建（标题必填）
- 列表：勾选完成 / 删除
- 字段范围：标题 + 完成状态 + 优先级 + 截止日期

### 10.6 开发节奏（TDD）

| MVU | 内容 | 验证 |
|-----|------|------|
| T1 | 工作台骨架：侧边栏 + 模块清单 + 空内容区 | npm test / cargo test / build |
| T2 | 建表 + list/create CRUD + 前端列表/新建 | CRUD 测试 + 渲染测试 |
| T3 | 勾选/删除/优先级/筛选完整交互 | 交互测试 |

开发实时同步本文档 + 开发日志。