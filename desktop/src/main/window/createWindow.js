import { BrowserWindow } from 'electron';
import { join } from 'node:path';

export function createWindow() {
  const window = new BrowserWindow({
    title: 'Qwen3 TTS Desktop',
    width: 1024,
    height: 768,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    webPreferences: {
      preload: join(import.meta.dirname, 'index.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    window.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    window.loadFile(join(import.meta.dirname, '../../dist/index.html'));
  }

  return window;
}
