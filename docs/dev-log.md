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

## M5: 截图结果保存/复制到剪贴板 (2026-08-02)

### 完成内容
- Rust: 添加 arboard 依赖，创建 StorageService 服务
- Rust: save_to_file 命令：Base64 解码后保存到用户 home 目录
- Rust: copy_to_clipboard 命令：Base64 → PNG → RGBA → 系统剪贴板
- Rust: 3 个单元测试 + 2 个命令签名测试
- 前端: capture.service.ts 添加 saveToFile / copyToClipboard 封装
- TDD: 4 个前端测试覆盖保存/复制按钮交互
- CaptureView 结果页：保存/复制/关闭按钮 + 状态提示

### 验证结果
- npm test: 33 passed (14 CaptureView + 4 MainView + 8 App + 7 capture.service)
- cargo test: 34 passed
- npm run build: 成功

### 关键决策
- arboard 3.4 用于跨平台剪贴板操作
- 保存到用户 home 目录，文件名格式 snapmaster_{timestamp}.png
- 保存/复制操作通过 setTimeout 3 秒后自动清除提示消息

## M6: 截图标注工具 (2026-08-02)

### 完成内容
- 标注数据模型 types/annotation.ts：Annotation 类型 + 工厂函数 + 序号计算（6 个测试）
- useAnnotations hook：数字/文字标注增删撤销、工具模式切换、颜色选择（11 个测试）
- CaptureView 结果页集成标注功能：
  - 默认数字模式：点击图片放置红色数字圆圈，从1递增
  - 文字模式：点击后弹出输入框，Enter 确认/Esc 取消
  - 颜色选择：红/蓝/绿/橙 4 色
  - 撤销/清除全部
- SVG 覆盖层渲染标注，不影响图片交互
- TDD: 7 个 CaptureView 标注交互测试

### 验证结果
- npm test: 59 passed (7 CaptureView标注 + 11 useAnnotations + 6 annotation + 4 MainView + 8 App + 7 capture.service + 16 CaptureView原有)
- npm run build: 成功

### 关键决策
- SVG 覆盖层使用 pointerEvents: 'none'，点击事件由 img 元素处理
- 数字圆圈半径 20px，白色描边 2px
- 文字标注用矩形背景 + 文字，宽度根据文字长度计算
- 默认红色 #F44336，符合需求

## M6.1: 标注合成到图片 (2026-08-02)

### 完成内容
- 创建 composeImage 工具函数：Canvas 绘制原图 + 标注 → 返回 data URL
- 数字标注：Canvas arc 圆圈 + fillText 数字
- 文字标注：fillRect 背景 + fillText 文字
- CaptureView 保存/复制时先调用 composeImage 合成标注，再传给后端
- TDD: 7 个 composeImage 测试 + 2 个更新测试

### 验证结果
- npm test: 66 passed
- npm run build: 成功

### 关键决策
- composeImage 使用 Canvas 2D API，与 SVG 渲染逻辑保持一致
- 合成后提取 Base64（去掉 data URL 前缀），传给后端 saveToFile / copyToClipboard
- 无标注时 composeImage 仍然执行（drawImage + toDataURL），保持统一路径

## M7: 全局快捷键触发截图 (2026-08-02)

### 完成内容
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

### 验证结果
- npm test: 73 passed (6 shortcut.service + 5 MainView + 其余 62)
- cargo test: 36 passed
- npm run build: 成功

### 关键决策
- 快捷键注册放在 Rust 端 setup 中，应用启动即生效，无需前端触发
- CAPTURE_SHORTCUT 常量前后端共用同一值，避免不一致（修复了 MainView 原硬编码 Ctrl+Shift+A 的错误）
- 截图窗口 label 用时间戳后缀保证唯一，支持多次触发不冲突
- on_shortcut 仅响应 Pressed 状态，避免释放时重复触发

## M8: 快捷键用户自定义 (2026-08-02)

### 完成内容
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

### 验证结果
- npm test: 109 passed (10 test files)
- cargo test: 50 passed
- npm run build: 成功

### 关键决策
- 持久化用 tauri-plugin-store 官方插件，配置存 config.json 的 "shortcuts" key
- 更新快捷键时先注册新值成功再持久化，注册失败保持原配置不破坏
- 录制式捕获：按下组合键自动识别，强制至少一个修饰键避免单键冲突
- 修饰键固定顺序 Ctrl+Shift+Alt+Super，与 Tauri Shortcut 解析一致
- MainView 卡片快捷键从后端配置动态读取，设置变更后同步刷新
- ShortcutConfig 字段 color-picker 用 kebab-case 序列化，与 action 标识一致

## M9: 贴图功能 (2026-08-02)

### 完成内容
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

### 验证结果
- npm test: 140 passed (12 test files)
- cargo test: 60 passed
- npm run build: 成功

### 关键决策
- 图片跨窗口传递用 Rust 内存缓存（同进程共享），不用文件/store，简单高效
- stash 用前端生成的完整 label（pin-{ts}）作 key，createWindow 传 suffix，Rust 拼出相同 label，保证取数据 key 一致
- 先 stash 再 createWindow，避免窗口加载时数据未就绪
- 调整大小用自定义右下角手柄 + setSize(LogicalSize)，不依赖系统缩放，体验一致
- 窗口尺寸下限 80x60，防止缩到不可见
- 贴图入口仅在截图结果页，符合主流程，避免过度设计
