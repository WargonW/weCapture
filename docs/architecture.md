# SnapMaster 架构设计

## 技术栈

| 层级 | 选型 | 版本 |
|------|------|------|
| 桌面框架 | Tauri | 2.x |
| 前端框架 | React + TypeScript + Vite | 19 / 5.x / 8.x |
| UI 组件库 | MUI (Material UI) | v6 |
| 状态管理 | Zustand | v5 |
| 路由 | React Router | v7 |
| 前端测试 | Vitest + React Testing Library | v2 |
| Rust 截图 | xcap | 0.9.x |
| Rust 录屏帧采集 | xcap (video_recorder) | 0.9.x |
| H.264 编码 | openh264 | 0.9.x |
| MP4 封装 | muxide | 0.2.x |
| GIF 编码 | gif crate | - |
| 图像处理 | image + imageproc | - |
| 全局热键 | tauri-plugin-global-shortcut | - |
| 剪贴板 | tauri-plugin-clipboard-manager + arboard | - |
| Rust 测试 | cargo test + mockall | - |

## 分层架构

```
src-tauri/                     # Rust 后端
├── src/
│   ├── core/                  # [领域层] 纯业务模型，无外部依赖
│   │   ├── mod.rs
│   │   ├── color.rs           # RgbColor: HEX/RGB 转换
│   │   ├── screenshot.rs      # (后续) 截图模型
│   │   ├── recorder.rs        # (后续) 录屏模型
│   │   └── annotation.rs      # (后续) 标注模型
│   │
│   ├── platform/              # [抽象层] Trait 定义，可替换实现
│   │   ├── capture_trait.rs   # (后续) Capture trait
│   │   ├── recorder_trait.rs  # (后续) Recorder trait
│   │   └── hotkey_trait.rs    # (后续) Hotkey trait
│   │
│   ├── services/              # [服务层] 业务逻辑编排
│   │   ├── capture_service.rs # (后续) 截图流程
│   │   ├── recorder_service.rs# (后续) 录屏流程
│   │   ├── annotation_service.rs # (后续) 标注合成
│   │   ├── storage_service.rs # (后续) 保存/剪贴板
│   │   ├── shortcut_config.rs # 快捷键配置模型 + store 持久化
│   │   ├── shortcut_service.rs # 全局快捷键注册/注销/更新
│   │   ├── pin_service.rs     # (后续) 贴图窗口
│   │   └── color_picker.rs    # (后续) 屏幕取色
│   │
│   ├── commands/              # [接口层] Tauri Commands
│   │   ├── capture_cmd.rs     # (后续) 截图命令
│   │   ├── recorder_cmd.rs    # (后续) 录屏命令
│   │   └── settings_cmd.rs    # (后续) 设置命令
│   │
│   └── main.rs                # 入口
│
src/                           # React 前端
├── views/                     # (后续) 多窗口视图
├── components/                # (后续) 可复用组件
├── stores/                    # (后续) Zustand 状态
├── services/                  # (后续) Tauri invoke 封装
├── composables/               # (后续) 复用逻辑 hooks
├── types/                     # (后续) TS 类型定义
├── App.tsx                    # 主窗口组件
├── App.test.tsx               # 主窗口测试
├── main.tsx                   # 入口 + MUI ThemeProvider
└── test-setup.ts              # Vitest 测试 setup
```

## 设计原则

1. **前后端职责清晰**：Rust 负责系统调用和图像处理，React 负责 UI 交互
2. **面向接口编程**：platform 层定义 Trait，可替换底层实现
3. **TDD 开发**：每个功能先写测试（Red），再实现（Green），再重构（Refactor）
4. **低耦合高内聚**：模块间通过 Trait/接口通信，避免直接依赖

## 录屏数据流（无 ffmpeg）

```
xcap 逐帧采集 BGRA → openh264 编码 H.264 NAL → muxide 封装 MP4
                     gif crate 编码 GIF      → 直接写文件
```

## 迭代计划

| 阶段 | MVU | 状态 |
|------|-----|------|
| P0 | M1: 项目骨架 | ✅ 完成 |
| P0 | M2: 多窗口机制 | ✅ 完成 |
| P1 | M3-M6: 核心截图 | 待开发 |
| P2 | M7-M9: 标注系统 | 待开发 |
| P3 | M10-M12: 录屏 | 待开发 |
| P4 | M13-M15: 增强功能 | 待开发 |
| P5 | M16-M18: 完善 | 待开发 |
