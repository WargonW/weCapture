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
| Rust 截图 | xcap | 0.9 |
| Rust 录屏帧采集 | xcap (capture_image 逐帧) | 0.9 |
| H.264 编码 | openh264 | 0.7 |
| MP4 封装 | muxide | 0.2 |
| Opus 音频编码 | opus crate (libopus) | 0.3 |
| 系统音频采集 | cpal (ALSAPulseAudio) | 0.17（optional `audio` feature） |
| GIF 编码 | gif crate | 0.14 |
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
│   ├── services/              # [服务层] 业务逻辑编排
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

## 截图数据流（多屏兼容）

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

## 录屏数据流（无 ffmpeg）

### MP4 路径（H.264 视频 + 可选 Opus 音频）

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

### GIF 路径（无音频）

```
xcap 逐帧采集 RGBA
  → downsample_rgba（最近邻缩放到 ≤480px 宽，等比）
  → GifEncoder.write_frame(rgba, delay_ms)
    （Frame::from_rgba_speed 自动量化 256 色调色板）
  → 写入 ~/snapmaster_record_{ts}.gif
```

GIF 限制：最大宽度 480px、录制时长 10 分钟（文件大小保护）。
两条路径互斥，由 `RecorderConfig.output_format` 决定，`run_recording` 分发。

### 录屏状态机

```
Idle ──start──▶ Recording ──stop──▶ Stopped ──reset──▶ Idle
                  │
                  └──cancel──▶ Idle（不产生结果）
```

- `RecorderService` 全局单例，跨 Tauri 命令保持会话状态
- 后台线程持有 `Arc<AtomicBool>` 停止标志，主线程设置后线程立即结束
- 错误通过 `Arc<Mutex<Option<String>>>` 传递回主线程
- 录制超过 1 小时自动停止（保护机制）

### 录屏窗口三阶段交互

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

### 帧率与时间戳

- 默认 30 FPS，通过 `frame_interval_ms()` 计算帧间隔（1000/fps）
- `sleep_with_flag` 每 10ms 检查停止标志，保证停止响应 <10ms
- PTS 按固定步长 `1.0/fps` 递增，首帧标记为关键帧

## 迭代计划

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
