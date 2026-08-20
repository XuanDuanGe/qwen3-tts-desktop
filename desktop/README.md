# Qwen3 TTS Desktop

一款基于 Qwen3 的 TTS 桌面工具。

## 启动

```bash
pnpm dev
```

## 构建

```bash
pnpm build
```

## 目录结构

- `src/main`：Electron 主进程组合入口、窗口、engine 生命周期、IPC 处理。
- `src/preload`：按 API 分组的预加载桥接层。
- `src/shared`：main / renderer 共用常量。
- `src/renderer`：React 渲染进程页面、layout、feature、状态和样式。

## Windows 试用包

在仓库根目录执行：

```bash
pnpm package:win
```

该命令先使用根目录 `.venv` 构建 Python sidecar，再生成 NSIS 安装程序。输出文件位于 `desktop/release/`，名称为 `Qwen3 TTS Desktop-0.1.0-win-x64-setup.exe`。

安装包包含 Electron 应用和 Qwen TTS Python 运行时，但**不包含模型权重**。首次在“语音生成”中选择模型并点击“开始生成”时，应用会下载所选模型；推荐先选体积较小的 `Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice`。模型、缓存与生成的 WAV 文件保存在当前 Windows 用户的应用数据目录中。
