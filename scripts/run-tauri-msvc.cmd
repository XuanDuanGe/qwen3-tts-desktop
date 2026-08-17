@echo off
setlocal

rem Honor an explicit location for portable or nonstandard Build Tools installs.
if not defined VSROOT if defined QWEN3_TTS_VSROOT set "VSROOT=%QWEN3_TTS_VSROOT%"
if not defined VSROOT if exist "E:\01-application\62-vs-build-tools\Common7\Tools\VsDevCmd.bat" set "VSROOT=E:\01-application\62-vs-build-tools"

if not defined VSROOT (
  set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
  if exist "%VSWHERE%" (
    for /f "usebackq delims=" %%I in (`"%VSWHERE%" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`) do set "VSROOT=%%I"
  )
)

if not defined VSROOT (
  echo Visual Studio installation with MSVC tools not found. Set QWEN3_TTS_VSROOT to the Build Tools directory.
  exit /b 1
)

set "VSDEVCMD=%VSROOT%\Common7\Tools\VsDevCmd.bat"
if not exist "%VSDEVCMD%" (
  echo VsDevCmd.bat not found: %VSDEVCMD%
  exit /b 1
)

call "%VSDEVCMD%" -arch=x64 -host_arch=x64 >nul
if errorlevel 1 exit /b %errorlevel%

cd /d "%~dp0.."
if defined QWEN3_TTS_PNPM (
  call "%QWEN3_TTS_PNPM%" %*
) else if exist "%LOCALAPPDATA%\node\corepack\v1\pnpm\10.15.0\bin\pnpm.cjs" (
  call "%~dp0pnpm-msvc.cmd" %*
) else (
  call pnpm %*
)
exit /b %errorlevel%
