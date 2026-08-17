import { BrowserWindow, ipcMain } from 'electron';

function getWindow(event) {
  return BrowserWindow.fromWebContents(event.sender);
}

export function registerWindowControlHandlers() {
  ipcMain.handle('window:minimize', (event) => {
    getWindow(event)?.minimize();
  });

  ipcMain.handle('window:toggle-maximize', (event) => {
    const window = getWindow(event);

    if (!window) {
      return false;
    }

    if (window.isMaximized()) {
      window.unmaximize();
      return false;
    }

    window.maximize();
    return true;
  });

  ipcMain.handle('window:close', (event) => {
    getWindow(event)?.close();
  });

  ipcMain.handle('window:is-maximized', (event) => {
    return getWindow(event)?.isMaximized() ?? false;
  });
}
