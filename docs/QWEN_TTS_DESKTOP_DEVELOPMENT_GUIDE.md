# Qwen TTS Desktop：开发模式目录结构与全服务启动指南

> 本文定义 `qwen-tts-desktop` 的推荐开发态目录结构、职责边界和“一条命令启动整套服务”的方式。
>
> **目标**：开发时保留独立 Python 虚拟环境以快速迭代和调试；发布时将 inference engine 打包成私有 sidecar，终端用户不接触 venv。

## 1. 设计原则

1. **桌面 UI、Rust 宿主、Python 推理引擎分层**：React 不直接接触 Python、模型或任意本地路径。
2. **开发态和发布态不同**：开发态使用仓库根目录 `.venv/`；发布态使用 PyInstaller/嵌入式 CPython 打包后的私有 engine。
3. **生产内部 IPC 用 stdio**：Rust 启动 Python 并通过 NDJSON 通信；FastAPI 只作为可选调试接口，不作为主要桌面内部协议。
4. **模型/缓存/输出不进入 Git**：全部写入应用数据目录；开发态可显式重定向到仓库下 `.local/`。
5. **Qwen 官方推理留在 Python**：Rust 负责进程、数据目录、文件授权和 IPC，而不复刻模型。
6. **模型显式安装**：启动开发服务和启动应用都不应自动下载多 GB 模型。

---

## 2. 推荐仓库根目录

建议新建独立仓库，而不是继续在现有 Gradio 仓库内直接堆叠 Tauri 文件：

```text
qwen-tts-desktop/
├─ README.md
├─ CONTRIBUTING.md
├─ LICENSES/                         # 第三方许可证与归档
├─ .gitignore
├─ .editorconfig
├─ .env.example
├─ .env.development.example
├─ package.json                       # 根 workspace scripts
├─ pnpm-workspace.yaml
├─ pnpm-lock.yaml
├─ Cargo.toml                         # 可选：Rust workspace 根
├─ rust-toolchain.toml
├─ justfile                           # 可选：跨平台开发任务入口
│
├─ apps/
│  └─ desktop/                        # Tauri 2 + React 应用
│
├─ crates/
│  ├─ desktop-core/                   # Rust：engine 管理、IPC、commands
│  └─ tts-protocol/                   # Rust：版本化 IPC DTO / event types
│
├─ engine/                            # Python Qwen 推理引擎源代码
│
├─ packages/
│  ├─ protocol/                       # TS IPC DTO、Zod schema、生成类型
│  ├─ ui/                             # 可选：共享 React UI 组件
│  └─ config/                         # 可选：共享 eslint/tsconfig/vite 配置
│
├─ scripts/                           # bootstrap、诊断、打包、模型工具
├─ tests/                             # 跨组件 E2E / fixtures
├─ docs/                              # 架构、协议、发行和开发文档
├─ resources/                         # 小型静态资源；不存大模型
├─ .local/                            # 开发运行时数据，gitignore
│  ├─ app-data/
│  ├─ cache/
│  ├─ logs/
│  └─ models/                         # 可通过链接或显式配置使用已有模型
└─ dist/                              # 构建产物，gitignore
```

### 为什么不把模型、venv 放在 `apps/desktop/`

- 该目录应保持为可复现的前端/Tauri 源码；
- 模型和 Python 包体积巨大，不应该污染前端热更新和 Git 状态；
- 后续 PyInstaller 输出、模型下载、应用升级和桌面 AppData 迁移会更清晰；
- `.local/` 结构可以近似模拟发布态的 AppData/Cache，但无需碰真实用户数据。

---

## 3. 根目录文件职责

```text
qwen-tts-desktop/
├─ package.json
├─ pnpm-workspace.yaml
├─ Cargo.toml
├─ rust-toolchain.toml
├─ .env.example
├─ .env.development.example
├─ .gitignore
└─ justfile
```

### `package.json`

根脚本统一开发入口。建议最终对开发者只暴露：

```json
{
  "scripts": {
    "dev": "pnpm --filter @qwen-tts/desktop tauri dev",
    "desktop:dev": "pnpm --filter @qwen-tts/desktop tauri dev",
    "desktop:build": "pnpm --filter @qwen-tts/desktop tauri build",
    "web:check": "pnpm --filter @qwen-tts/desktop check",
    "engine:test": "python -m pytest engine/tests",
    "engine:lint": "ruff check engine/src engine/tests",
    "rust:check": "cargo check --workspace",
    "test": "pnpm web:check && pnpm engine:test && pnpm rust:check"
  }
}
```

实际工作区包名可不同；关键要求是 `pnpm dev` 能启动完整开发栈。

### `.env.development`

不要把本机路径、token、模型目录提交到 Git。开发态可包含：

```dotenv
QWEN_TTS_ENGINE_MODE=development
QWEN_TTS_DEV_DATA_DIR=E:/workspace/qwen-tts-desktop/.local/app-data
QWEN_TTS_DEV_CACHE_DIR=E:/workspace/qwen-tts-desktop/.local/cache
QWEN_TTS_DEV_MODEL_DIR=E:/models/qwen-tts
QWEN_TTS_DEVICE=auto
QWEN_TTS_LOG_LEVEL=DEBUG
```

Rust 读取这些变量后，把绝对路径传给 engine；前端不读取模型真实路径。

### `.gitignore`

至少忽略：

```gitignore
node_modules/
dist/
target/
.venv/
.local/
.pytest_cache/
.ruff_cache/
__pycache__/
*.py[cod]
.env
.env.development
engine/build/
engine/dist/
*.spec
```

---

## 4. `apps/desktop/`：Tauri 2 + React 前端

```text
apps/desktop/
├─ package.json
├─ index.html
├─ tsconfig.json
├─ vite.config.ts
├─ eslint.config.js
├─ src/
│  ├─ main.tsx
│  ├─ App.tsx
│  ├─ styles/
│  │  ├─ globals.css
│  │  └─ tokens.css
│  ├─ routes/
│  │  ├─ home.tsx
│  │  ├─ generate.tsx
│  │  ├─ models.tsx
│  │  ├─ history.tsx
│  │  └─ settings.tsx
│  ├─ features/
│  │  ├─ generation/
│  │  │  ├─ GenerateForm.tsx
│  │  │  ├─ CustomVoiceForm.tsx
│  │  │  ├─ VoiceCloneForm.tsx
│  │  │  ├─ VoiceDesignForm.tsx
│  │  │  ├─ SamplingPanel.tsx
│  │  │  └─ generationStore.ts
│  │  ├─ jobs/
│  │  │  ├─ JobList.tsx
│  │  │  ├─ JobProgress.tsx
│  │  │  ├─ jobStore.ts
│  │  │  └─ useJobEvents.ts
│  │  ├─ models/
│  │  │  ├─ ModelCatalog.tsx
│  │  │  ├─ ModelDownloadCard.tsx
│  │  │  ├─ ModelStatus.tsx
│  │  │  └─ modelStore.ts
│  │  ├─ artifacts/
│  │  │  ├─ AudioPlayer.tsx
│  │  │  ├─ ArtifactList.tsx
│  │  │  └─ ExportButton.tsx
│  │  └─ privacy/
│  │     └─ VoiceCloneConsentDialog.tsx
│  ├─ lib/
│  │  ├─ desktopClient.ts
│  │  ├─ events.ts
│  │  ├─ validation.ts
│  │  └─ audio.ts
│  ├─ hooks/
│  │  ├─ useEngineStatus.ts
│  │  └─ useArtifactUrl.ts
│  ├─ components/
│  │  ├─ layout/
│  │  └─ common/
│  └─ types/
│     └─ generated.ts
│
├─ public/
│  ├─ icons/
│  └─ licenses/
│
└─ src-tauri/
   ├─ Cargo.toml
   ├─ build.rs
   ├─ tauri.conf.json
   ├─ capabilities/
   │  └─ default.json
   ├─ icons/
   ├─ binaries/                       # release sidecar target binaries only
   └─ src/
      ├─ main.rs
      ├─ lib.rs
      ├─ commands.rs
      ├─ app_state.rs
      ├─ errors.rs
      ├─ engine/
      │  ├─ manager.rs
      │  ├─ launcher.rs
      │  ├─ process.rs
      │  ├─ protocol.rs
      │  ├─ event_bridge.rs
      │  └─ dev_paths.rs
      ├─ services/
      │  ├─ files.rs
      │  ├─ app_paths.rs
      │  ├─ model_import.rs
      │  └─ diagnostics.rs
      └─ commands/
         ├─ engine.rs
         ├─ jobs.rs
         ├─ models.rs
         ├─ artifacts.rs
         └─ settings.rs
```

## 4.1 前端的职责

React 只负责 UI 状态和用户交互：

- 生成表单和采样参数；
- 模型安装/删除界面；
- 任务状态、取消、播放和导出；
- 声音克隆授权确认和隐私提示；
- 应用设置与诊断信息展示。

React **不应**：

- 启动 Python；
- 使用 Shell plugin 执行任意命令；
- 传递任意绝对参考音频路径给 engine；
- 直接读取模型目录；
- 保存或持有 engine 的通信 token。

React 只调用窄化 Tauri command，例如：

```ts
await invoke("jobs_submit", { request });
await invoke("jobs_cancel", { jobId });
await invoke("models_download", { modelId });
await invoke("artifacts_export", { artifactId });
```

通过 Tauri event 接收：

```text
engine-status
job-updated
model-download-progress
artifact-created
```

## 4.2 `src-tauri` 的职责

Rust host 是安全与进程边界：

- 根据 debug/release 自动选择 engine 启动方式；
- 建立 stdin/stdout NDJSON 收发循环；
- 将 engine 事件转发为 Tauri events；
- 管理 request ID、超时和 engine 崩溃；
- 根据 Tauri AppHandle 获取 app-data、cache、log 目录；
- 通过 dialog/file APIs 处理用户选择和导出；
- 维护应用状态（engine ready、当前 jobs、pending requests）；
- 将 renderer 允许执行的动作限制为已注册 commands。

`capabilities/default.json` 只授予必需的 dialog、文件保存、通知等权限；不要给 renderer 宽泛 shell 权限。

---

## 5. `engine/`：Python 推理引擎

```text
engine/
├─ pyproject.toml
├─ requirements.lock                  # 锁定、可复现的开发/发行依赖
├─ README.md
├─ qwen_tts_engine.spec               # PyInstaller one-folder spec（发布）
├─ src/
│  └─ qwen_tts_engine/
│     ├─ __init__.py
│     ├─ __main__.py                  # 开发调试 CLI
│     ├─ stdio_server.py              # 生产内部 IPC 入口
│     ├─ bootstrap.py                 # 显式创建 container；绝不自动 pip install
│     ├─ domain/
│     │  ├─ enums.py
│     │  ├─ errors.py
│     │  ├─ requests.py
│     │  ├─ jobs.py
│     │  ├─ models.py
│     │  └─ protocol.py
│     ├─ application/
│     │  ├─ job_service.py
│     │  ├─ inference_service.py
│     │  ├─ model_service.py
│     │  ├─ artifact_service.py
│     │  └─ reference_service.py
│     ├─ infrastructure/
│     │  ├─ qwen_runtime.py
│     │  ├─ model_registry.py
│     │  ├─ model_downloader.py
│     │  ├─ hub_clients.py
│     │  ├─ artifact_store.py
│     │  ├─ reference_store.py
│     │  ├─ settings_store.py
│     │  └─ runtime_paths.py
│     ├─ runtime/
│     │  ├─ job_queue.py
│     │  ├─ cancellation.py
│     │  ├─ device_manager.py
│     │  ├─ lifecycle.py
│     │  └─ event_publisher.py
│     └─ testing/
│        └─ fake_runtime.py
│
├─ tests/
│  ├─ conftest.py
│  ├─ unit/
│  │  ├─ test_domain.py
│  │  ├─ test_job_queue.py
│  │  ├─ test_model_registry.py
│  │  ├─ test_artifact_store.py
│  │  └─ test_reference_store.py
│  ├─ contract/
│  │  └─ test_stdio_protocol.py
│  └─ integration/
│     └─ test_qwen_smoke.py           # 显式 opt-in；不可自动下载模型
│
└─ scripts/
   ├─ verify_runtime.py
   ├─ build_sidecar.py
   └─ inspect_model_snapshot.py
```

## 5.1 `pyproject.toml` 的依赖分组

建议分层：

```toml
[project]
dependencies = [
  "soundfile",
]

[project.optional-dependencies]
ml = [
  "torch",
  "torchaudio",
  "qwen-tts==<pinned-version>",
  "transformers==<pinned-version>",
  "accelerate==<pinned-version>",
]
hubs = ["modelscope", "huggingface_hub"]
dev = ["pytest", "ruff", "pyinstaller"]
```

实际版本必须通过目标平台的真实模型 smoke test 后固定。不要继续依赖宽松的 `qwen-tts>=...` 作为桌面发行依据。

生产 stdio 引擎不需要携带 Gradio；FastAPI/Uvicorn 仅在你明确保留调试 HTTP adapter 时才作为可选依赖。

## 5.2 engine 内部职责

| 模块 | 责任 |
|---|---|
| `domain/` | 纯数据结构、能力枚举、稳定错误、IPC DTO |
| `qwen_runtime.py` | 延迟导入 torch/qwen-tts；一个活跃模型；调用三类 `generate_*` |
| `model_registry.py` | 模型 ID、能力、repo、revision、安装状态 |
| `model_downloader.py` | 显式下载、staging、完整性验证、原子替换 |
| `reference_store.py` | UUID 临时音频、大小/格式/时长检查、finally 清理 |
| `artifact_store.py` | WAV 原子落盘、metadata、受控读取/删除 |
| `job_queue.py` | FIFO 单 worker、队列位置、按 job 取消 |
| `stdio_server.py` | 只处理协议；stdout 不输出普通日志 |

核心约束：`QwenRuntime` 接收已经验证的本地模型 snapshot 路径，**不同时承担下载、任意路径访问和 UI 逻辑**。

---

## 6. TypeScript 与 Rust/Python 协议目录

推荐维护一个语言无关的协议源：

```text
packages/protocol/
├─ README.md
├─ protocol.schema.json               # JSON Schema，唯一契约源
├─ src/
│  ├─ requests.ts
│  ├─ events.ts
│  ├─ jobs.ts
│  ├─ models.ts
│  └─ validation.ts
└─ scripts/
   └─ generate.ts
```

Rust 的 `crates/tts-protocol/` 和 Python 的 `engine/domain/protocol.py` 按此 schema 映射或自动生成。

### 最低协议消息集合

```text
engine.hello
engine.health
engine.shutdown
models.list
models.install
models.remove
models.unload
references.import
references.remove
jobs.submit
jobs.get
jobs.cancel
artifacts.get
artifacts.delete
```

异步事件：

```text
engine.ready
engine.error
model.download_progress
job.updated
job.completed
job.failed
artifact.created
```

所有消息都包含：

```json
{
  "version": 1,
  "id": "request-id-for-requests",
  "method": "jobs.submit",
  "params": {}
}
```

或者事件形态：

```json
{
  "version": 1,
  "event": "job.updated",
  "payload": {}
}
```

---

## 7. 开发态运行目录

开发时不应污染当前 Gradio 项目或用户真实的 AppData。推荐：

```text
qwen-tts-desktop/.local/
├─ app-data/
│  ├─ config/
│  ├─ models/
│  ├─ outputs/
│  ├─ temp/
│  │  ├─ references/
│  │  └─ uploads/
│  └─ logs/
├─ cache/
│  ├─ huggingface/
│  ├─ modelscope/
│  ├─ torch/
│  ├─ triton/
│  └─ python/
└─ diagnostics/
```

在 engine 初始化时，Rust 传入：

```text
--app-data-dir <repo>/.local/app-data
--cache-dir <repo>/.local/cache
```

引擎再设置其子进程环境：

```text
HF_HOME
MODELSCOPE_CACHE
TORCH_HOME
TORCHINDUCTOR_CACHE_DIR
TRITON_CACHE_DIR
```

不能在 Python import 阶段硬编码仓库路径，更不能继续使用原 Gradio 项目的 `cache/`、`outputs/` 或 `config.json`。

---

## 8. 开发依赖和首次初始化

以下以 Windows + Git Bash 为例；其他平台替换 Python 可执行文件路径即可。

### 8.1 必备开发工具

- Node.js LTS；
- `pnpm`（通过 Corepack）；
- Rust stable 与目标平台 C/C++ 编译工具链；
- Python 3.11+；
- Git；
- 选择性安装：FFmpeg/SoX，用于开发期音频诊断和格式兼容验证；
- 如果目标是 NVIDIA GPU：在开发机器安装匹配的显卡驱动，并选择经验证的 PyTorch CUDA 轮子。

### 8.2 一次性初始化

```bash
# 1. 前端/Rust workspace
corepack enable
pnpm install

# 2. Python 开发环境（仅开发者机器）
python -m venv .venv
./.venv/Scripts/python.exe -m pip install --upgrade pip
./.venv/Scripts/python.exe -m pip install -e "./engine[ml,hubs,dev]"

# 3. 建立独立开发运行目录
mkdir -p .local/app-data .local/cache .local/logs
cp .env.development.example .env.development
```

不要把模型下载放在 bootstrap 中。模型由桌面 Model Manager 显式下载，或由专用开发命令导入：

```bash
pnpm engine:inspect-model -- <snapshot-dir>
```

### 8.3 开发期间的模型策略

- 默认不下载模型；用 `FakeRuntime` 跑绝大多数 engine、Rust 和 UI 测试；
- 真实模型 smoke test 必须显式 opt-in，例如：

```bash
QWEN_TTS_SMOKE_MODEL_DIR=E:/models/Qwen3-TTS-12Hz-0.6B-CustomVoice \
  ./.venv/Scripts/python.exe -m pytest engine/tests/integration/test_qwen_smoke.py
```

- 本地已有模型时通过 `.env.development` 或模型导入功能注册；
- 不将模型、snapshot、HF token、ModelScope token 放入 Git。

---

## 9. 一条命令启动完整开发服务

## 推荐入口

```bash
pnpm dev
```

这条命令应该完成以下链路：

```text
pnpm dev
  → Vite dev server
  → cargo tauri dev
  → Tauri Rust host 启动 desktop window
  → Rust 的 EngineManager 启动 .venv 中的 Python engine
  → engine 通过 stdout 发送 engine.ready
  → Rust 建立 NDJSON reader/writer
  → React 通过 Tauri events 收到 engine-status=ready
```

因此，日常开发**不应该**另开一个终端手动运行 Python engine。Rust 必须像发布态一样负责 engine 生命周期；这是开发态最重要的真实性验证。

### 9.1 Rust 在开发态选择 Python executable

`apps/desktop/src-tauri/src/engine/launcher.rs` 应依据构建模式选择：

```text
Debug / tauri dev
  → <workspace>/.venv/Scripts/python.exe
  → -m qwen_tts_engine.stdio_server

Release / packaged app
  → Tauri resource/externalBin 中的 qwen-tts-engine
```

开发路径只能通过明确配置或受控的 workspace root 推导取得，并在启动前校验文件存在。不要调用用户 PATH 里的随机 `python`。

建议对开发配置建立一个结构：

```rust
pub struct EngineLaunchConfig {
    pub program: PathBuf,
    pub args: Vec<OsString>,
    pub app_data_dir: PathBuf,
    pub cache_dir: PathBuf,
    pub device: String,
    pub protocol_version: u32,
}
```

启动参数例如：

```text
<repo>/.venv/Scripts/python.exe
  -m qwen_tts_engine.stdio_server
  --app-data-dir <repo>/.local/app-data
  --cache-dir <repo>/.local/cache
  --device auto
  --protocol-version 1
```

### 9.2 readiness 和超时

engine 必须在准备好读取协议后写出唯一一行：

```json
{"version":1,"event":"engine.ready","engineVersion":"0.1.0","capabilities":["jobs","models","artifacts"]}
```

Rust 应：

1. 在有限超时内等待 `engine.ready`；
2. 捕获 stderr 到日志文件；
3. readiness 失败时显示诊断信息，而不是无限加载；
4. engine 崩溃时将运行任务标记为失败；
5. 提供受控“重启推理引擎”命令；
6. 退出应用时先发送 `engine.shutdown`，再超时 terminate。

### 9.3 手动单独调试 engine

只有开发协议或 engine 时才手动运行：

```bash
./.venv/Scripts/python.exe -m qwen_tts_engine.stdio_server \
  --app-data-dir "$PWD/.local/app-data" \
  --cache-dir "$PWD/.local/cache" \
  --device auto \
  --protocol-version 1
```

此时可手工向 stdin 发送一行 NDJSON。该模式不应替代 `pnpm dev` 的正常桌面联调。

---

## 10. 开发脚本建议

```text
pnpm dev                     # 启动完整 Tauri + engine 开发栈
pnpm desktop:dev             # 同上，显式名称
pnpm web:check               # TypeScript/lint/test
pnpm rust:check              # cargo check --workspace
pnpm engine:test             # FakeRuntime 单元/协议测试
pnpm engine:lint             # ruff
pnpm test                    # 所有轻量测试
pnpm engine:smoke            # 显式真实模型测试，默认拒绝无模型运行
pnpm engine:package          # PyInstaller one-folder sidecar
pnpm desktop:build           # 调用已打包 sidecar 构建 Tauri 安装器
```

若使用 `justfile`，可提供同义命令：

```make
bootstrap:
    corepack enable
    pnpm install
    python -m venv .venv
    ./.venv/Scripts/python.exe -m pip install -e "./engine[ml,hubs,dev]"

dev:
    pnpm dev

test:
    pnpm test
```

---

## 11. 发布目录与开发目录的映射

| 开发态 | 发布态 |
|---|---|
| `.venv/Scripts/python.exe -m qwen_tts_engine.stdio_server` | PyInstaller/嵌入式 CPython sidecar executable |
| `.local/app-data` | Tauri `app_local_data_dir()` |
| `.local/cache` | Tauri `app_cache_dir()` |
| `.local/logs` | 平台 app log dir |
| 手动设置的本地模型目录 | `AppData/QwenTTSDesktop/models/` |
| Vite HMR | 打包后的前端资产 |
| `cargo tauri dev` | Tauri installer/app bundle |

要求 Rust `EngineManager` 在 debug/release 两个模式下使用**同一个协议、同一套 Job 行为、同一套数据目录契约**。两者差异只能是如何解析 executable 路径。

---

## 12. 最小 MVP 切分

### Milestone 1：可启动、可通信

- Tauri 空壳 + React；
- Python stdio server；
- `engine.hello` / `engine.ready`；
- Rust `EngineManager`；
- `pnpm dev` 一次启动全栈；
- FakeRuntime 返回静音 WAV artifact。

### Milestone 2：任务与输出

- Job submit/get/cancel；
- FIFO 单 worker；
- artifact list/play/export；
- React Job list；
- 进程重启、日志和失败状态。

### Milestone 3：模型与真实生成

- ModelRegistry 与显式下载；
- 0.6B CustomVoice 真模型 smoke test；
- 受控 app-data/cache；
- 模型切换和设备诊断。

### Milestone 4：克隆与安全边界

- 参考音频导入、校验、UUID 临时存储；
- ICL/x-vector-only 显式 UI；
- 授权确认；
- finally 清理、缓存清除；
- VoiceDesign。

### Milestone 5：发行

- PyInstaller one-folder engine；
- Tauri externalBin/resource 集成；
- Windows x64 + NVIDIA CUDA 首发验证；
- clean-machine install/launch/model-download/generate/uninstall 测试；
- 许可证和隐私文档。

---

## 13. 必须避免的开发模式反模式

- React renderer 用 Shell plugin 直接启动 Python；
- `pnpm dev` 之外再要求开发者手动启动一个长期 Python server；
- debug 使用 HTTP、release 使用完全不同的协议；
- Python import 时自动下载模型或修改 pip 环境；
- 把模型、缓存、输出放到仓库安装目录；
- 通过任意绝对文件路径传递参考音频；
- stdout 输出日志导致 NDJSON 协议损坏；
- 同时加载多个大模型以“提高并发”；
- 在没有真实模型 smoke test 前承诺 PyInstaller/CUDA 可用；
- 为了减小安装包而忽略模型权重才是主要体积来源这一事实。

## 14. 参考文档

- 架构与 Qwen3-TTS 推理分析：`docs/QWEN_TTS_DESKTOP_ARCHITECTURE.md`
- 当前项目迁移边界：`docs/QWEN_TTS_CORE_MIGRATION_GUIDE.md`
- Tauri Sidecar：<https://v2.tauri.app/develop/sidecar/>
- Tauri Capabilities：<https://v2.tauri.app/security/capabilities/>
- PyInstaller one-folder：<https://pyinstaller.org/en/stable/operating-mode.html>
