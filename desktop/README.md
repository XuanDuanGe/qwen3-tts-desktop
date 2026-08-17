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

- `src/main`：Electron 主进程与 IPC 处理。
- `src/preload`：安全暴露给渲染进程的预加载接口。
- `src/renderer`：React 渲染进程页面、路由、状态和样式。
