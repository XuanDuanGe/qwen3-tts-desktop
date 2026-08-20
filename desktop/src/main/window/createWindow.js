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
    show: false,
    webPreferences: {
      preload: join(import.meta.dirname, 'index.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });

  window.once('ready-to-show', () => window.show());
  window.webContents.on('did-fail-load', (_, errorCode, errorDescription) => {
    console.error(
      `Renderer failed to load (${errorCode}): ${errorDescription}`,
    );
  });
  const load = process.env.VITE_DEV_SERVER_URL
    ? window.loadURL(process.env.VITE_DEV_SERVER_URL)
    : window.loadFile(join(import.meta.dirname, '../../dist/index.html'));
  void load.catch((error) => {
    console.error(`Renderer failed to load: ${error.message}`);
  });

  return window;
}
