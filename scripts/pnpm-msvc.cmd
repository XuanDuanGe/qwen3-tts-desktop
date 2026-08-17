@echo off
setlocal
node "%LOCALAPPDATA%\node\corepack\v1\pnpm\10.15.0\bin\pnpm.cjs" %*
exit /b %errorlevel%
