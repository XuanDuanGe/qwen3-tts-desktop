import { ipcRenderer } from 'electron';

export function createSettingsApi() {
  return {
    get: () => ipcRenderer.invoke('settings:get'),
    save: (settings) => ipcRenderer.invoke('settings:save', settings),
  };
}
