import { contextBridge, ipcRenderer } from 'electron';

const subscriptions = {
  engineStatus: 'engine:status-changed',
  jobUpdated: 'engine:job-updated',
  artifactCreated: 'engine:artifact-created',
};

function subscribe(channel, listener) {
  const handler = (_, payload) => listener(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld('api', {
  greet: (name) => ipcRenderer.invoke('greet', name),
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximizeWindow: () => ipcRenderer.invoke('window:toggle-maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  isWindowMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  platform: process.platform,
  telemetry: {
    track: (name, properties) =>
      ipcRenderer.invoke('telemetry:track', name, properties),
  },
  engine: {
    getStatus: () => ipcRenderer.invoke('engine:status'),
    models: {
      list: () => ipcRenderer.invoke('models:list'),
      capabilities: (modelId) =>
        ipcRenderer.invoke('models:capabilities', modelId),
      install: (modelId, proxy) =>
        ipcRenderer.invoke('models:install', { modelId, proxy }),
    },
    jobs: {
      submit: (params) => ipcRenderer.invoke('jobs:submit', params),
      get: (jobId) => ipcRenderer.invoke('jobs:get', jobId),
      cancel: (jobId) => ipcRenderer.invoke('jobs:cancel', jobId),
    },
    artifacts: {
      get: (artifactId) => ipcRenderer.invoke('artifacts:get', artifactId),
      delete: (artifactId) =>
        ipcRenderer.invoke('artifacts:delete', artifactId),
      read: (artifactId) => ipcRenderer.invoke('artifacts:read', artifactId),
      download: (artifactId) =>
        ipcRenderer.invoke('artifacts:download', artifactId),
    },
    onStatus: (listener) => subscribe(subscriptions.engineStatus, listener),
    onJobUpdated: (listener) => subscribe(subscriptions.jobUpdated, listener),
    onArtifactCreated: (listener) =>
      subscribe(subscriptions.artifactCreated, listener),
  },
});
