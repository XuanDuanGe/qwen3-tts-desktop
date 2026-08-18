import { ipcRenderer } from 'electron';

export function createTelemetryApi() {
  return {
    track: (name, properties) =>
      ipcRenderer.invoke('telemetry:track', name, properties),
  };
}
