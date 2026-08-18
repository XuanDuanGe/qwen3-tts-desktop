import { contextBridge, ipcRenderer } from 'electron';
import { createEngineApi } from './apis/engine.js';
import { createSettingsApi } from './apis/settings.js';
import { createTelemetryApi } from './apis/telemetry.js';
import { createWindowApi } from './apis/window.js';

contextBridge.exposeInMainWorld('api', {
  greet: (name) => ipcRenderer.invoke('greet', name),
  platform: process.platform,
  telemetry: createTelemetryApi(),
  engine: createEngineApi(),
  settings: createSettingsApi(),
  ...createWindowApi(),
});
