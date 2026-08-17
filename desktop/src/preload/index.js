import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  greet: (name) => ipcRenderer.invoke('greet', name),
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximizeWindow: () => ipcRenderer.invoke('window:toggle-maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  isWindowMaximized: () => ipcRenderer.invoke('window:is-maximized'),
});
