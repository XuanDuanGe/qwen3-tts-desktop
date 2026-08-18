# Qwen3-TTS Core

`core` 是 Qwen TTS Desktop 使用的 Python sidecar。它保留官方 `qwen-tts` 推理链路，通过 stdin/stdout 传输版本化 NDJSON，不依赖 Gradio 或 FastAPI。

## 安装

在仓库根目录创建虚拟环境并安装：

```bash
python -m venv .venv
.venv/Scripts/python.exe -m pip install -e core
```

PyTorch 的 CUDA 版本应根据目标机器单独选择。模型不会在安装依赖时自动下载。

## 启动

```bash
python -m qwen_tts_engine \
  --app-data-dir .local/app-data \
  --cache-dir .local/cache
```

## 包结构

- `qwen_tts_engine/runtime/`：Qwen 运行时预热、加载、卸载和推理。
- `qwen_tts_engine/models/`：模型注册表、能力查询、安装与完整性检查。
- `qwen_tts_engine/storage/`：路径管理、artifact 存储、参考音频存储。
- `qwen_tts_engine/jobs/`：单 worker 任务队列与状态推进。
- `qwen_tts_engine/server/`：NDJSON 协议与 sidecar 请求分发。

## 协议示例

请求：

```json
{"protocolVersion":1,"type":"request","requestId":"req-1","method":"engine.hello","params":{}}
```

响应：

```json
{"protocolVersion":1,"type":"response","requestId":"req-1","ok":true,"result":{"engine":"qwen-tts-engine","protocolVersion":1}}
```

stdout 只允许协议 JSON。日志写入 stderr。Electron main 后续会负责启动该进程、维护请求 ID、转发事件并在应用退出时关闭 sidecar。

## 数据目录

- `models/`：已验证的本地模型目录。
- `outputs/`：WAV 产物和元数据。
- `temp/references/`：受控参考音频。
- `logs/`：运行日志。
- cache 目录：Hugging Face、ModelScope、Torch 和 Triton 缓存。

参考音频应由 Electron main 通过文件选择器取得授权。生产环境不应向 sidecar 传递 renderer 任意路径；当前 `references.put` 仅用于 core 协议验证，正式接入时由 main 复制和授权后调用。

## 当前范围

已实现单模型、单 worker、CustomVoice、VoiceDesign、VoiceClone、任务状态、取消标记、引用音频、WAV artifact 和本地模型注册。模型下载、断点续传、FakeRuntime 测试和 PyInstaller 发行构建将在后续阶段补充。

源项目为 GPL-3.0。官方 Qwen SDK、模型权重、PyTorch 及其依赖拥有独立许可证，发布前必须单独完成许可证审查。
