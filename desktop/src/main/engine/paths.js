import { app } from 'electron';
import { join } from 'node:path';

const workspaceRoot = join(app.getAppPath(), '..');

export function getEnginePaths() {
  if (app.isPackaged) {
    return {
      command: join(process.resourcesPath, 'engine', 'qwen-tts-engine.exe'),
      args: [],
      cwd: process.resourcesPath,
      appData: app.getPath('userData'),
      cache: app.getPath('cache'),
      packaged: true,
    };
  }

  return {
    command: join(workspaceRoot, '.venv', 'Scripts', 'python.exe'),
    args: ['-m', 'qwen_tts_engine', '--device', 'cpu', '--dtype', 'float32'],
    cwd: join(workspaceRoot, 'core'),
    appData: join(workspaceRoot, '.local', 'app-data'),
    cache: join(workspaceRoot, '.local', 'cache'),
    packaged: false,
  };
}
