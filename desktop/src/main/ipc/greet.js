import { ipcMain } from 'electron';

export function registerGreetHandler() {
  ipcMain.handle('greet', (_, name) => `你好，${name}！`);
}
