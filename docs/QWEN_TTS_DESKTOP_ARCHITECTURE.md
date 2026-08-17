# Qwen TTS Desktop：Qwen3-TTS 实现分析与架构方案

> 本文说明当前项目如何调用 Qwen3-TTS，以及为什么 `qwen-tts-desktop` 的首发版本应采用 **Tauri 2 + Rust 宿主 + 私有 Python 推理 sidecar**，而不是直接重写为纯 Rust 推理。

## 1. 结论

### 推荐首发架构

```text
React / TypeScript UI
        │ Tauri invoke / events
        ▼
Tauri 2 Rust host
        │ 版本化 NDJSON stdio IPC（优先）
        ▼
随桌面应用分发的 Python inference engine
        │
        ├─ qwen-tts
        ├─ PyTorch / torchaudio
        ├─ Transformers / Accelerate
        ├─ Qwen3-TTS 模型快照
        └─ 音频、模型、缓存和任务服务
```

- 开发者使用 Python 虚拟环境；**终端用户不需要安装 Python、创建 venv 或运行 pip**。
- Rust 负责进程、文件、模型安装、权限、更新和桌面集成；Python 保留 Qwen 官方推理路径。
- 模型权重不放入初始安装包；用户按功能显式下载并存到应用数据目录。
- Rust-native 推理可作为长期 POC，但不应阻塞产品首发。

### 不建议的方案

- 直接把当前 Gradio WebUI 作为产品 sidecar；
- 正常启动时安装或升级 Python 包；
- 将所有模型打入安装器；
- 继续采用同步 Base64 API；
- 因为 llama.cpp 支持部分 Qwen 文本模型，就假设其支持 Qwen3-TTS；
- 直接以 Candle、ONNX 或 Rust 重写作为首发交付路径。

---

## 2. 当前项目如何调用 Qwen3-TTS

当前仓库并未自行实现 Qwen3-TTS 网络；它调用官方 Python SDK `qwen-tts`：

```text
Gradio UI / FastAPI
  → QwenTTSBackend
  → qwen_tts.Qwen3TTSModel
  → PyTorch + Transformers
  → Qwen3-TTS model + speech tokenizer
  → WAV 文件
```

直接依赖见 `requirements.txt:1-12`：

- `torch`、`torchvision`、`torchaudio`；
- `qwen-tts>=0.1.1`；
- `modelscope`、`huggingface_hub`；
- `soundfile`；
- `gradio`、`fastapi`、`uvicorn`、`pydantic`。

### 2.1 启动和共享运行时

```text
start.bat / start.ps1 / start.sh
  → 生成或激活 venv
  → launch.py
  → qwen_tts_webui.main.main()
  → Gradio，或 --nowebui 启动 FastAPI
```

定位：

- 启动转发：`launch.py:3-6`；
- 主分支：`qwen_tts_webui/main.py:47-150`；
- 全局后端单例：`qwen_tts_webui/config_manager/shared.py:83-97`；
- 全局 FIFO 锁：`qwen_tts_webui/task_manager/call_queue.py:12-34`。

所有 UI/API 请求共享一个 `QwenTTSBackend` 和一个 FIFO 队列。因此当前实现：

1. 同时只执行一个推理任务；
2. 仅保留一个已加载模型；
3. 切换模型时先卸载旧模型、GC、释放设备缓存，再加载新模型；
4. 混合使用不同能力模型时会承担模型切换时间。

该“单模型 + 单 worker”策略适合第一版单用户桌面应用，应保留；但其全局状态、同步 API 和临时文件实现需要重构。

### 2.2 模型查找、下载和加载

每次生成前，后端调用：

```python
Qwen3TTSModel.from_pretrained(
    pretrained_model_name_or_path=model_path,
    device_map=device_map,
    dtype=dtype,
    attn_implementation=attn_implementation,
)
```

位置：`qwen_tts_webui/backend/qwen_backend.py:167-173`。

执行序列：

```text
请求模型
  → 若当前模型相同：复用
  → 若不同：卸载旧模型、清理缓存
  → 本地快照查找
  → 不存在时从 ModelScope 或 Hugging Face 下载
  → Qwen3TTSModel.from_pretrained()
  → Transformers + PyTorch 加载模型、processor、speech tokenizer
```

定位：

- 同模型复用、切换/卸载：`qwen_tts_webui/backend/qwen_backend.py:54-117`；
- local/Hugging Face/ModelScope：`qwen_tts_webui/backend/qwen_backend.py:119-165`；
- 加载失败后的重新下载：`qwen_tts_webui/backend/qwen_backend.py:179-225`；
- 默认 provider、dtype、device map：`qwen_tts_webui/config_manager/shared.py:50-67`。

### 2.3 Qwen3-TTS 的实际推理链

Qwen3-TTS 不等于通用文本模型加任意 vocoder。完整链路为：

```text
文本 / 风格描述 / speaker / 参考音频
  → 文本 tokenizer 和条件 prompt 组装
  → 自回归 talker 生成离散语音 codec token
  → 多 codebook / sub-talker 预测
  → Qwen speech tokenizer / neural codec 解码
  → 24 kHz waveform
  → soundfile.write(..., WAV)
```

其中涉及生成循环、KV cache、采样器、16 codebook 的 12 Hz speech tokenizer、专属神经 codec、Clone speaker embedding 和 ICL prompt 构造。这也是不能把 `.safetensors` 直接交给通用 Rust LLM runtime 的原因。

---

## 3. 三类能力的调用边界

| 能力 | 模型 | 主要输入 | Qwen SDK 调用 |
|---|---|---|---|
| CustomVoice | `*-CustomVoice` | text、speaker、language、可选 instruct | `generate_custom_voice()` |
| VoiceClone | `*-Base` | text、reference audio、可选 transcript | `generate_voice_clone()` |
| VoiceDesign | `*-VoiceDesign` | text、必填声音描述 instruct、language | `generate_voice_design()` |

模型配置：`qwen_tts_webui/config_manager/config.py:27-42`。

### 3.1 CustomVoice

调用链：

```text
frontend.generate_voice_fn()
  → load_model(CustomVoice)
  → QwenTTSBackend.generate_custom_voice()
  → self.model.generate_custom_voice(...)
  → save_audio(wavs[0], sample_rate)
```

定位：

- UI：`qwen_tts_webui/frontend.py:488-548`；
- 后端：`qwen_tts_webui/backend/qwen_backend.py:285-367`；
- 保存：`qwen_tts_webui/backend/qwen_backend.py:542-562`。

采样参数包括 `top_k`、`top_p`、`temperature`、`repetition_penalty`、subtalker 参数和 `max_new_tokens`。

注意：`0.6B-CustomVoice` 会由上游 SDK 忽略 `instruct`，桌面 UI 应明确提示该限制，而不是让用户误以为风格描述一定生效。

### 3.2 VoiceDesign

调用链：

```text
frontend.generate_design_fn()
  → load_model(VoiceDesign)
  → QwenTTSBackend.generate_voice_design()
  → self.model.generate_voice_design(...)
  → save_audio(wavs[0], sample_rate)
```

定位：

- UI：`qwen_tts_webui/frontend.py:558-623`；
- 后端：`qwen_tts_webui/backend/qwen_backend.py:369-447`。

VoiceDesign 按自然语言描述设计输出声线，不应接收 `speaker`、`ref_audio` 或 `ref_text`。

### 3.3 VoiceClone：x-vector-only 与 ICL

调用链：

```text
参考音频
  → load_model(Base)
  → QwenTTSBackend.generate_voice_clone()
  → self.model.generate_voice_clone(...)
  → Qwen 预处理参考音频、构造 clone prompt
  → 生成 codec token 并解码为 WAV
```

定位：

- UI：`qwen_tts_webui/frontend.py:625-698`；
- 后端：`qwen_tts_webui/backend/qwen_backend.py:449-540`；
- API：`qwen_tts_webui/api/api.py:307-387`。

当前模式由 `ref_text` 是否为空隐式决定：

```python
x_vector_only_mode = ref_text is None or ref_text.strip() == ""
```

| 参考文本 | 模式 | 条件信息 | 产品含义 |
|---|---|---|---|
| 空 | x-vector-only | speaker embedding | 简化路径，克隆质量通常较低 |
| 非空 | ICL | speaker embedding + 参考音频 codec token + transcript | 更完整的条件，通常质量更好 |

高质量克隆不是只计算一个 speaker embedding；ICL 还需要对参考音频做 Qwen codec 编码，并结合参考文本参与 prompt 构造。

---

## 4. 为什么不建议首发使用纯 Rust

### 4.1 Rust 在理论上可行，但没有现成运行时

| 候选 | 结论 |
|---|---|
| llama.cpp / GGUF | 当前不可行；不支持 Qwen3-TTS talker、16 codebook、codec、Clone/ICL 体系 |
| Candle | 可作为 tensor 基础，但必须自行实现全套网络、生成循环、codec 和 prompt pipeline |
| ONNX Runtime + Rust `ort` | 最合理的长期研究方向；没有官方完整 ONNX bundle/exporter |
| MLX | 仅 macOS/Apple Silicon，且没有现成 Qwen3-TTS 实现 |
| Python sidecar | 当前唯一可保留完整官方能力、可较快产品化的路径 |

### 4.2 真正的 Rust/Candle 移植范围

完整移植至少需要：

```text
Qwen3-TTS attention / RoPE / RMSNorm / MLP
+ KV cache 与自回归采样
+ 多 codebook / sub-talker
+ 文本 tokenizer
+ Clone prompt builder
+ speaker encoder 与音频重采样
+ 12 Hz VQ speech tokenizer
+ neural codec decoder
+ CPU / CUDA / Metal 后端测试
```

这是推理引擎研发项目，不是封装/打包工作。即使读取 safetensors 成功，也仍不能证明声音质量、采样行为、显存占用和 VoiceClone ICL 会与官方实现一致。

### 4.3 ONNX 的正确定位

若未来必须去 Python，建议进行独立 ONNX POC。它至少需要：

```text
prefill graph
+ one-token decode graph（带 KV cache I/O）
+ sub-talker/code-predictor graph
+ codec decoder graph
+ speaker encoder graph
+ Rust text tokenizer、采样、prompt assembly
+ 与 PyTorch 的音频回归测试
```

只有在 CustomVoice、至少一种 VoiceClone、性能/内存、导出可重复性和质量回归都通过后，才应将 Rust-native 设为产品路线。

---

## 5. 生产版建议架构

### 5.1 Rust host 的责任

- 启动、监控、重启、关闭 inference engine；
- 提供平台 AppData、Cache、Logs 目录；
- 系统文件选择、参考音频导入、产物导出；
- 模型下载、断点续传、hash/manifest/snapshot 校验；
- 维护 IPC request/event；
- 限制 renderer 权限；
- 把 engine 状态映射为 Tauri command/event。

### 5.2 Python engine 的责任

- 模型 registry、下载器、完整 snapshot 校验；
- Qwen runtime；
- 单模型常驻、模型切换与设备缓存清理；
- FIFO JobQueue 和按 job 的协作取消；
- artifact store；
- 参考音频 upload/reference store；
- 稳定错误码、结构化事件和诊断。

### 5.3 IPC：优先 stdio NDJSON

生产内部通道优先：

```text
Rust host ── stdin/stdout ── Python engine
```

优点：没有监听端口、无端口冲突、降低本机攻击面、不会触发防火墙，Rust 也能成为唯一 sidecar 控制者。

请求示例：

```json
{"version":1,"id":"req_123","method":"jobs.submit","params":{"kind":"custom_voice","modelId":"qwen3-tts-12hz-0.6b-customvoice","text":"你好"}}
```

事件示例：

```json
{"version":1,"event":"job.updated","job":{"id":"job_123","status":"running","progress":0.42}}
```

要求：

- stdout 只能写 NDJSON 协议消息；日志写入 stderr/文件；
- Rust 维护 request ID 与 pending request；
- sidecar 异常退出时标记任务失败，并支持受控重启；
- React renderer 不直接执行 sidecar。

FastAPI 可作为开发调试/自动化接口保留；若使用，必须只绑定 loopback 并使用每次启动生成的 bearer token。

---

## 6. 运行时与模型分发

### 6.1 不让用户管理 venv

开发态：

```text
Python + venv/uv + test/build tools
```

发行态：

```text
Tauri installer
  ├─ Rust host
  ├─ WebView UI
  └─ 私有 inference engine
      ├─ CPython runtime
      ├─ PyTorch/native libraries
      ├─ qwen-tts
      └─ 项目 engine 代码
```

推荐先验证 **PyInstaller one-folder** sidecar：它不消除 Python/PyTorch 体积，但消除了用户安装和维护 Python 环境的负担。不要优先采用 PyInstaller one-file，因为 PyTorch/native DLL 的诊断、启动和更新更困难。

Windows-first 时，也可评估嵌入式 CPython + 预装 site-packages 的私有运行时。Nuitka 可以作为后续对照实验，但不会消除模型或 PyTorch 的实际体积。

### 6.2 模型按需下载

模型权重是体积的主导项。不要预装所有模型：

```text
AppData/QwenTTSDesktop/
├─ models/
├─ outputs/
├─ temp/references/
├─ config/
├─ cache/
└─ logs/
```

模型管理必须支持：

- 明确能力、模型版本、下载体积、所需磁盘空间；
- 下载、暂停、恢复和完整性校验；
- 删除和离线导入；
- 固定 revision/manifest；
- 仅在用户明确操作时下载；
- 当前已加载模型和设备诊断。

推荐初始引导安装一个模型：

| 产品功能 | 建议模型 |
|---|---|
| 基础预置音色 TTS | `0.6B-CustomVoice` |
| 指令控制的预置声音 | `1.7B-CustomVoice` |
| 声音设计 | `1.7B-VoiceDesign` |
| 高质量本地克隆 | Base + ICL transcript |
| 更快但较低质量克隆 | Base + x-vector-only |

---

## 7. Job、artifact 和隐私边界

使用异步 Job，而不是同步 Base64 响应：

```text
queued → preparing → loading_model → running → writing_artifact → succeeded
                         └────→ failed
                         └────→ cancelling → cancelled
```

输出写到受控 artifact 路径，向 UI 返回 opaque artifact ID 与 metadata，而不是绝对文件路径或 Base64。

VoiceClone 要求：

1. 通过系统文件选择器取得用户授权；
2. 将参考音频复制到 `AppData/.../temp/references/<uuid>`；
3. 校验格式、大小、时长和可读性；
4. 引擎只接收内部 `referenceAudioId`，不接收任意路径；
5. 成功、失败和取消都在 `finally` 清理；
6. UI 显示克隆授权确认、临时保存说明和“立即清除”操作。

---

## 8. 实施优先级

1. 抽取无 Gradio 的 Python engine；
2. 建立 stdio Job protocol、model registry、artifact/reference store；
3. 使用 FakeRuntime 完成无模型测试；
4. 用一个真实模型完成本地 smoke test；
5. Rust host 接管 engine 生命周期和受控文件操作；
6. React 实现模型、任务、生成、播放和导出 UI；
7. 使用 PyInstaller one-folder 构建每个平台的 engine；
8. 先支持一个清晰平台组合，例如 Windows x64 + NVIDIA CUDA；
9. 最后再扩展 CPU、macOS/MPS、Linux/CUDA 等变体；
10. 将 Rust-native ONNX/Candle 作为独立 POC，而非首发阻塞项。

## 9. 许可证与产品责任

当前仓库的 `pyproject.toml:5-12` 标注 GPL-3.0。若复用/修改/分发其代码，应进行 GPL 合规评估。Qwen SDK、模型、PyTorch、ONNX Runtime 等许可证也应逐项核对。

VoiceClone 涉及声纹及身份模仿能力；桌面产品应要求用户确认拥有参考音频和声线授权，并清晰说明音频处理、存储和删除策略。
