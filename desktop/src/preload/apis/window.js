import { ipcRenderer } from 'electron';

export function createWindowApi() {
  return {
    minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximizeWindow: () => ipcRenderer.invoke('window:toggle-maximize'),
    closeWindow: () => ipcRenderer.invoke('window:close'),
    isWindowMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  };
}
