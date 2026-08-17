import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { registerGreetHandler } from './ipc/greet.js';
import { registerWindowControlHandlers } from './ipc/windowControls.js';

function createWindow() {
  const window = new BrowserWindow({
    title: 'Qwen3 TTS Desktop',
    width: 1024,
    height: 768,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    webPreferences: {
      preload: join(import.meta.dirname, 'index.mjs'),
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    window.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    window.loadFile(join(import.meta.dirname, '../../dist/index.html'));
  }
}

app.whenReady().then(() => {
  registerGreetHandler();
  registerWindowControlHandlers();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
