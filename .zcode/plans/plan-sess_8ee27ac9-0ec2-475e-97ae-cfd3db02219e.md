当前系统仅安装了 Build Tools 外壳，未包含 Tauri/MSVC 链接所需组件；因此无法在本机启动或验证应用。检测不到 `VsDevCmd.bat`、`cl.exe`、MSVC `link.exe`、`rc.exe` 与 Windows SDK import libraries。项目的 GNU linker 问题已通过根 `rust-toolchain.toml` 固定为 `stable-x86_64-pc-windows-msvc` 规避。

下一步需在 Visual Studio Installer 修改现有 Build Tools 安装，勾选 **Desktop development with C++**，并确认包含：
- MSVC v143 VS 2022 C++ x64/x86 build tools
- Windows 10 SDK 或 Windows 11 SDK
- C++ CMake tools for Windows（建议）

安装完成后重开终端。届时将：
1. 检测 `vswhere.exe`、`VsDevCmd.bat`、`cl.exe`、Microsoft `link.exe`、`rc.exe` 和 SDK library 路径。
2. 如有必要，为根命令加入可移植的 MSVC 环境加载包装器，不把本机绝对安装路径写入仓库。
3. 清理已忽略的 `desktop/src-tauri/target`，执行完整 Tauri debug build。
4. 从仓库根执行 `pnpm dev`，验证窗口与 HomePage 的 `greet` IPC 后停止进程。
5. 最终给出可直接复制的根目录启动和构建命令。