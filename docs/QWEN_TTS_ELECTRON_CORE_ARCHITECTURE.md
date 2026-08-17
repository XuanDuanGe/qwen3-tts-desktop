# Qwen3-TTS Electron 核心模块架构设计

## 1. 文档目的

本文将 `QWEN_TTS_DESKTOP_ARCHITECTURE.md` 和 `QWEN_TTS_DESKTOP_DEVELOPMENT_GUIDE.md` 中面向 Tauri 的方案迁移到当前 Electron monorepo，作为后续引入 Qwen3-TTS 核心模块的唯一实现依据。

目标是保留官方 `qwen-tts` 和 PyTorch 推理链路，同时使用 Electron 主进程替代 Tauri Rust host，建立安全、可测试、可打包的桌面应用架构。

首个目标平台为 Windows x64。首个版本采用单模型、单 worker、单任务执行，不追求并发推理或多模型常驻。

## 2. 总体架构

```text
React Renderer
    │ secure contextBridge API and events
    ▼
Electron Main Process
    ├── Window and lifecycle management
    ├── EngineManager
    ├── NDJSON protocol client
    ├── model, reference, job, artifact services
    ├── app data paths and file dialogs
    └── renderer IPC validation
    │ private stdin/stdout NDJSON
    ▼
Python Qwen3-TTS Sidecar
    ├── stdio_server
    ├── protocol and request dispatch
    ├── model registry and verified local snapshots
    ├── single active Qwen runtime
    ├── FIFO job worker and cancellation
    ├── reference audio store
    └── atomic WAV artifact store
    │
    ▼
qwen-tts / PyTorch / Transformers / audio codec
```

Renderer 只处理界面状态和用户操作。Electron main 是唯一可以启动 Python、访问真实文件路径、打开文件对话框和控制 sidecar 的进程。Python sidecar 不监听端口，不暴露 HTTP 服务，不被 renderer 直接启动。

## 3. 目录规划

当前 Electron 项目不复制 Tauri 的 Rust workspace，而是在现有目录中按职责扩展：

```text
desktop/
├── src/
│   ├── main/
│   │   ├── index.js
│   │   ├── ipc/
│   │   └── engine/
│   │       ├── manager.js
│   │       ├── protocol.js
│   │       ├── paths.js
│   │       ├── models.js
│   │       ├── references.js
│   │       ├── jobs.js
│   │       └── artifacts.js
│   ├── preload/
│   │   └── index.js
│   └── renderer/src/
│       ├── api/
│       ├── components/
│       ├── pages/
│       ├── routes/
│       ├── store/
│       ├── utils/
│       └── styles/
├── resources/
│   └── engine/
├── scripts/
└── electron-builder.json5
engine/
├── qwen_tts_engine/
│   ├── stdio_server.py
│   ├── bootstrap.py
│   ├── protocol.py
│   ├── domain/
│   ├── application/
│   ├── infrastructure/
│   └── runtime/
└── tests/
packages/
└── protocol/
    └── protocol.schema.json
```

开发态的 Python 包位于仓库 `.venv`，不会复制到 `desktop/src`。发行态 sidecar 位于打包资源目录，不写入 asar。

## 4. 进程生命周期

### 4.1 开发环境

从仓库根目录执行 `pnpm dev`。Electron main 在 `app.whenReady()` 后启动 sidecar，不要求用户额外打开 Python 服务。

Python 解释器固定解析为：

```text
<workspace>/.venv/Scripts/python.exe
```

模块入口为：

```text
python -m qwen_tts_engine.stdio_server --app-data-dir <path> --cache-dir <path> --protocol-version 1
```

启动参数由 Electron main 生成，不能由 renderer 传入。sidecar 输出 `engine.ready` 后，main 才向 renderer 派发可用状态。

### 4.2 发行环境

发行包使用 PyInstaller one-folder sidecar，暂不采用 one-file。Electron Builder 通过 `extraResources` 将 sidecar 放到：

```text
process.resourcesPath/engine/
```

Windows x64 的入口为：

```text
process.resourcesPath/engine/qwen-tts-engine.exe
```

开发和发行只允许改变 sidecar 可执行文件解析方式，协议、任务状态、目录契约和错误语义必须保持一致。

### 4.3 关闭、崩溃和重启

- app 启动时只允许一个 EngineManager 实例。
- sidecar 启动超时、协议版本不匹配或提前退出时，main 记录 stderr 和日志，并向 renderer 发送不可用状态。
- sidecar 退出时，所有 pending request 标记失败，运行中的 job 标记为 `failed`。
- 应用退出前先发送 `engine.shutdown`，等待有限时间后结束子进程。
- 不自动无限重启。允许一次受控重启，并将重启原因显示为诊断信息。
- stdout 只允许 NDJSON 协议消息；Python 日志必须写 stderr 或日志文件。

## 5. NDJSON 协议

协议版本从 `1` 开始，规范文件位于 `packages/protocol/protocol.schema.json`，Python 和 Electron main 均以该文件为契约来源。

### 5.1 请求

```json
{
  "protocolVersion": 1,
  "type": "request",
  "requestId": "req-uuid",
  "method": "jobs.submit",
  "params": {}
}
```

### 5.2 响应

```json
{
  "protocolVersion": 1,
  "type": "response",
  "requestId": "req-uuid",
  "ok": true,
  "result": {}
}
```

失败响应：

```json
{
  "protocolVersion": 1,
  "type": "response",
  "requestId": "req-uuid",
  "ok": false,
  "error": {
    "code": "MODEL_NOT_INSTALLED",
    "message": "Model is not installed",
    "details": {}
  }
}
```

### 5.3 事件

```json
{
  "protocolVersion": 1,
  "type": "event",
  "event": "jobs.updated",
  "payload": {}
}
```

Electron main 按行读取 stdout、解析 JSON、校验版本和基本字段，再按 requestId 完成请求或转发事件。renderer 不接触 Python stdout。

### 5.4 最小方法集合

| 方法 | 用途 |
| --- | --- |
| `engine.hello` | 握手和能力协商 |
| `engine.health` | 获取运行状态 |
| `engine.shutdown` | 有序关闭 |
| `models.list` | 列出模型和安装状态 |
| `models.install` | 显式安装指定模型版本 |
| `models.remove` | 删除模型 |
| `models.unload` | 卸载当前模型并清理缓存 |
| `references.import` | 接收 main 已授权的参考音频 |
| `references.remove` | 删除参考音频 |
| `jobs.submit` | 提交语音生成或克隆任务 |
| `jobs.get` | 查询任务状态 |
| `jobs.cancel` | 请求取消任务 |
| `artifacts.get` | 获取产物元数据 |
| `artifacts.delete` | 删除产物 |

事件集合：`engine.ready`、`engine.status`、`models.progress`、`jobs.updated`、`artifacts.created`、`engine.error`。

## 6. Qwen3-TTS 运行时

Python 保留官方 Qwen3-TTS 推理路径，不在 Electron main 中实现模型推理。runtime 只接收已验证的本地模型 snapshot，不在生成过程中隐式联网下载。

支持的调用边界：

- CustomVoice：文本、语言、说话人和可选指令。
- VoiceDesign：文本、语言和声音描述。
- VoiceClone：文本、语言、参考音频 ID、可选参考文本。

单 worker 使用 FIFO 队列。任务状态统一为：

```text
queued → preparing → loading_model → running → writing_artifact → succeeded
```

异常状态为 `failed`、`cancelling`、`cancelled`。模型切换前卸载当前模型，执行垃圾回收和设备缓存清理，再加载新模型。

初期先实现 `FakeRuntime`，输出固定静音 WAV，用于验证协议、任务和产物链路；通过真实 Qwen runtime smoke test 后再接入界面。

## 7. 模型管理

模型不进入安装包，也不在应用首次启动时自动下载。用户必须明确选择安装、导入或删除。

Electron main 负责模型目录和下载权限，Python registry 负责快照校验和 runtime 读取。推荐流程：

1. 下载到 staging 目录。
2. 校验 revision、文件清单和 hash。
3. 原子替换到最终 snapshot 目录。
4. 写入模型 manifest。
5. 向 renderer 派发进度和完成事件。

下载必须支持断点续传、暂停、恢复、失败清理和离线导入。模型目录不向 renderer 暴露绝对路径。

## 8. 文件、参考音频和产物

发布环境目录使用 Electron 的 `app.getPath('userData')`：

```text
<userData>/models/
<userData>/outputs/
<userData>/temp/references/
<userData>/config/
<userData>/logs/
<userData>/cache/
```

开发环境使用仓库：

```text
<workspace>/.local/app-data/
<workspace>/.local/cache/
```

参考音频必须由 Electron main 通过系统文件对话框取得授权。main 将文件复制到 UUID 临时目录，校验格式、大小和时长后，只向 Python 传递 `referenceAudioId`。任务结束、取消或失败时清理临时引用。用户必须能主动清除引用并看到隐私提示。

生成结果保存为应用数据目录中的 WAV 和 JSON 元数据。renderer 只接收 opaque `artifactId`、格式、时长和状态，不接收绝对路径或 Base64 音频。导出动作由 main 通过保存对话框完成。

## 9. Electron 安全边界

- `nodeIntegration: false`、`contextIsolation: true`、`sandbox: true`、`webSecurity: true`。
- preload 只暴露固定方法和固定事件订阅，不暴露 `ipcRenderer`、Node API、shell 或通用 channel。
- renderer 不得 spawn Python、执行 shell、读取模型目录或任意本地路径。
- main 校验 IPC sender，只接受当前 BrowserWindow 的请求。
- 导航限制在应用页面，拒绝任意外部页面和新窗口。
- IPC 返回值和 sidecar 消息均进行结构校验。
- 主进程与 Python 日志不得进入 stdout 协议流。

建议的 preload API：

```text
engine.getStatus()
models.list()
models.install(modelId, revision)
models.remove(modelId)
references.import()
references.remove(referenceAudioId)
jobs.submit(params)
jobs.get(jobId)
jobs.cancel(jobId)
artifacts.get(artifactId)
artifacts.export(artifactId)
onEngineStatus(listener)
onJobUpdated(listener)
onModelProgress(listener)
onArtifactCreated(listener)
```

所有事件订阅方法必须返回 unsubscribe 函数，避免页面切换造成监听器泄漏。

## 10. Renderer 结构

当前 renderer 继续使用 `api`、`store`、`pages`、`components` 目录：

- `api/engine.js`：调用 preload 的固定方法。
- `store/engineStore.js`：保存 ready、busy、error 和能力状态。
- `store/jobStore.js`：保存任务状态和进度。
- `store/modelStore.js`：保存模型列表及安装进度。
- `components/EngineStatus`：显示 sidecar 状态和诊断信息。
- `pages/VoiceGeneratePage`：提交 CustomVoice/VoiceDesign 任务。
- `pages/VoiceClonePage`：选择已授权引用并提交 clone 任务。
- `pages/SettingsPage`：模型、缓存、日志和隐私清理操作。

页面不能直接访问 Electron API。所有业务请求经过 renderer api wrapper，再经 preload 到 main。

## 11. 实施顺序

### 阶段一：协议和 Python 最小引擎

- 创建 protocol schema 和版本校验。
- 抽取无 Gradio 的 Python engine。
- 实现 `stdio_server`、hello、health、shutdown。
- 实现 FakeRuntime 和固定 WAV artifact。
- 为协议、退出、错误和取消编写测试。

### 阶段二：Electron EngineManager

- 实现路径服务和开发/发行 executable resolver。
- 实现 child process spawn、stdin 写入、stdout 按行解析、stderr 日志。
- 实现 requestId pending map、ready timeout、退出失败传播和有序 shutdown。
- 通过固定 preload API 映射协议方法和事件。

### 阶段三：模型、引用和产物

- 实现模型 registry、显式安装、校验、删除和 unload。
- 实现 picker 授权、referenceAudioId、临时文件清理。
- 实现任务队列、取消和原子 WAV/JSON artifact store。
- 使用 FakeRuntime 完成端到端验证。

### 阶段四：真实 Qwen runtime

- 锁定 `torch`、`torchaudio`、`qwen-tts`、Transformers 和 Accelerate 版本。
- 先完成 0.6B 模型 smoke test，再支持更大模型。
- 验证 CustomVoice、VoiceDesign 和 VoiceClone 的真实音频产物。
- 验证 GPU、CPU fallback、模型切换和显存释放。

### 阶段五：打包和界面

- 使用 PyInstaller one-folder 构建 sidecar。
- 通过 Electron Builder `extraResources` 打包 sidecar，不放入 asar。
- 接入模型、生成、克隆、设置页面。
- 在干净 Windows x64 环境验证安装、启动、升级、CUDA DLL 和卸载。

## 12. 验证门槛

每个阶段都必须满足：

- stdout 没有非 JSON 行。
- 协议版本、requestId 和错误结构稳定。
- sidecar 崩溃时 pending 请求不会永久等待。
- 应用退出不会留下 Python 子进程。
- renderer 无真实路径、shell 和任意 IPC 权限。
- debug/release 使用同一协议和数据契约。
- 模型未安装时不会隐式下载。
- 参考音频在任务完成、失败和取消后按规则清理。
- 产物可通过 artifactId 查询和导出。

真实模型测试必须单独执行，不把模型、缓存、音频和 PyTorch 二进制提交到 Git。

## 13. 禁止事项

- 不在 renderer 中启动 Python 或执行命令。
- 不用 Gradio/FastAPI 作为正式桌面通信层。
- 不把协议改成随机端口 HTTP。
- 不把绝对路径、访问 token 或模型路径传给 renderer。
- 不用 Base64 在 IPC 中传输完整音频。
- 不在运行时自动 pip install 或自动下载模型。
- 不把所有模型和 CUDA 运行时放入初始安装包。
- 不实现多模型并发和多 worker，除非后续架构评审明确批准。
- 不在 Python stdout 输出普通日志。

## 14. 设计结论

当前项目最合理的 Qwen3-TTS 集成方案是：Electron main 作为受控桌面 host，Python 作为官方 Qwen runtime sidecar，两者通过版本化 NDJSON stdio 通信，React renderer 通过最小 contextBridge API 使用异步任务、模型、参考音频和 artifact 服务。

该方案最大限度复用官方 qwen-tts 推理实现，保持与原 Tauri 文档相同的安全边界和可测试性，并将 Electron 的主进程能力用于替代 Tauri Rust host。后续核心模块实现必须遵循本文的协议、目录、生命周期和数据路径约束，不得先从 renderer 直接调用 Python 或引入临时 HTTP 服务。
