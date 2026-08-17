# qwen3-tts-desktop

qwen3-tts-desktop 是一个基于 Tauri 2、React、JavaScript 与 Vite 的桌面工具，提供语音生成、声音克隆和应用设置页面的基础结构。

## 启动

```bash
pnpm install
pnpm tauri dev
```

## 构建

```bash
pnpm tauri build
```

## 目录结构

```text
src/
├── api/                 Tauri 命令调用封装
├── components/          通用 React 组件
├── pages/               页面组件
├── routes/              Hash 路由配置
├── store/               Zustand 全局状态
├── styles/              Tailwind 与全局样式
└── utils/               工具函数

src-tauri/
├── src/
│   ├── commands/        Rust 命令
│   ├── models/           Rust 数据模型
│   └── utils/            Rust 工具函数
├── Cargo.toml            Rust 依赖配置
└── tauri.conf.json       Tauri 应用配置
```
