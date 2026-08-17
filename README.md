# Qwen3 TTS Desktop

Qwen TTS 的 Tauri 2 桌面客户端。当前仓库使用 pnpm workspace 管理，`desktop/` 包承载 React 前端与 Tauri Rust host。

## 启动

在仓库根目录：

```bash
pnpm dev
```

或进入桌面应用目录：

```bash
cd desktop
pnpm tauri dev
```

## 构建

在仓库根目录：

```bash
pnpm build
```

或进入桌面应用目录：

```bash
cd desktop
pnpm tauri build
```

## 目录结构

```text
.
├── desktop/
│   ├── src/
│   │   ├── api/           Tauri 命令调用封装
│   │   ├── components/    通用 React 组件
│   │   ├── pages/         页面组件
│   │   ├── routes/        路由配置
│   │   ├── store/         Zustand 全局状态
│   │   ├── styles/        全局样式
│   │   └── utils/         前端工具函数
│   └── src-tauri/
│       └── src/
│           ├── commands/  Tauri 命令
│           ├── models/    Rust 数据模型
│           └── utils/     Rust 工具函数
├── core/                  后续桌面核心能力
├── contracts/             后续跨层协议契约
└── docs/                  架构与开发文档
```
