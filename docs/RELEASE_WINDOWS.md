# v0.1.0 Windows 发布

## 本地打包

在 Windows + Git Bash 中，从仓库根目录执行：

```bash
pnpm install --frozen-lockfile
python -m venv .venv
./.venv/Scripts/python.exe -m pip install --upgrade pip
./.venv/Scripts/python.exe -m pip install -r core/requirements-release.txt
./.venv/Scripts/python.exe -m pip install --no-deps -e core
pnpm package:win
```

安装程序输出到 `desktop/release/`，文件名为：

```text
Qwen3 TTS Desktop-0.1.0-win-x64-setup.exe
```

安装包包含 Electron 应用和 PyInstaller one-folder 的 Qwen TTS sidecar，不包含模型权重。首次使用时，在“语音生成”选择模型并点击“开始生成”，应用会通过 ModelScope 下载模型。建议先使用 `0.6B-CustomVoice`；需要预留模型磁盘空间，并准备可访问 ModelScope 的网络或 HTTP 代理。

## 推送 v0.1.0 到 GitHub

先确认工作区只包含应发布的源码、锁文件、脚本和工作流；不要提交 `node_modules`、`.venv`、模型、`desktop/build-resources` 或 `desktop/release`。然后执行：

```bash
git add .
git diff --cached --stat
git commit -m "release: v0.1.0"
git push origin main
git tag -a v0.1.0 -m "Qwen3 TTS Desktop v0.1.0"
git push origin v0.1.0
```

推送 `v0.1.0` 后，`.github/workflows/release-windows.yml` 会在 `windows-2022` runner 上安装 Node、pnpm 和 Python，构建 sidecar，运行启动握手验证，构建 NSIS setup，生成 SHA-256 文件，并把 setup 和校验文件上传到 GitHub Release。

GitHub 仓库的 Actions 设置中需要允许 Actions 创建和写入 Releases（Workflow permissions 选择 **Read and write permissions**）。工作流使用内置 `GITHUB_TOKEN`，不需要额外 Secret。

## 发布前注意

- `desktop/package.json`、`core/pyproject.toml` 和 Git tag 的版本必须一致：`0.1.0` / `v0.1.0`。
- 当前构建目标是 Windows x64；未签名，Windows SmartScreen 可能显示警告。
- 发布包不提供离线 TTS；模型下载完成后才能生成 WAV。
- Qwen SDK、模型、PyTorch 及其依赖有独立许可证，正式公开发布前应补充许可证清单并确认 GPL-3.0 合规。
