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
