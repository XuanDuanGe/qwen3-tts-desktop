# qwen3-tts-desktop

qwen3-tts-desktop 是一个基于 Tauri 2、React、JavaScript 与 Vite 的桌面端语音工具界面原型，当前已包含自定义窗口栏、左侧导航和四个基础子页面。

## 启动

```bash
pnpm install
pnpm tauri dev
```

## 构建

```bash
pnpm tauri build
```

## 当前前端结构

```text
src/
├── components/          自定义窗口栏、导航栏与布局组件
├── pages/               首页、语音生成、语音克隆、设置页面
├── routes/              Hash 路由配置
└── styles/              Tailwind 与全局样式

src-tauri/
├── capabilities/        Tauri 权限能力配置
├── src/
│   ├── lib.rs           Tauri 应用入口
│   └── main.rs          桌面端启动入口
├── Cargo.toml           Rust 依赖配置
└── tauri.conf.json      Tauri 应用配置
```
