"use strict";
const electron = require("electron");
const subscriptions = {
  engineStatus: "engine:status-changed",
  jobUpdated: "engine:job-updated",
  artifactCreated: "engine:artifact-created"
};
function subscribe(channel, listener) {
  const handler = (_, payload) => listener(payload);
  electron.ipcRenderer.on(channel, handler);
  return () => electron.ipcRenderer.removeListener(channel, handler);
}
function createEngineApi() {
  return {
    getStatus: () => electron.ipcRenderer.invoke("engine:status"),
    models: {
      list: () => electron.ipcRenderer.invoke("models:list"),
      capabilities: (modelId) => electron.ipcRenderer.invoke("models:capabilities", modelId),
      install: (modelId, proxy) => electron.ipcRenderer.invoke("models:install", { modelId, proxy })
    },
    jobs: {
      submit: (params) => electron.ipcRenderer.invoke("jobs:submit", params),
      get: (jobId) => electron.ipcRenderer.invoke("jobs:get", jobId),
      cancel: (jobId) => electron.ipcRenderer.invoke("jobs:cancel", jobId)
    },
    artifacts: {
      list: () => electron.ipcRenderer.invoke("artifacts:list"),
      get: (artifactId) => electron.ipcRenderer.invoke("artifacts:get", artifactId),
      delete: (artifactId) => electron.ipcRenderer.invoke("artifacts:delete", artifactId),
      read: (artifactId) => electron.ipcRenderer.invoke("artifacts:read", artifactId),
      download: (artifactId) => electron.ipcRenderer.invoke("artifacts:download", artifactId)
    },
    onStatus: (listener) => subscribe(subscriptions.engineStatus, listener),
    onJobUpdated: (listener) => subscribe(subscriptions.jobUpdated, listener),
    onArtifactCreated: (listener) => subscribe(subscriptions.artifactCreated, listener)
  };
}
function createSettingsApi() {
  return {
    get: () => electron.ipcRenderer.invoke("settings:get"),
    save: (settings) => electron.ipcRenderer.invoke("settings:save", settings)
  };
}
function createTelemetryApi() {
  return {
    track: (name, properties) => electron.ipcRenderer.invoke("telemetry:track", name, properties)
  };
}
function createWindowApi() {
  return {
    minimizeWindow: () => electron.ipcRenderer.invoke("window:minimize"),
    toggleMaximizeWindow: () => electron.ipcRenderer.invoke("window:toggle-maximize"),
    closeWindow: () => electron.ipcRenderer.invoke("window:close"),
    isWindowMaximized: () => electron.ipcRenderer.invoke("window:is-maximized")
  };
}
electron.contextBridge.exposeInMainWorld("api", {
  greet: (name) => electron.ipcRenderer.invoke("greet", name),
  platform: process.platform,
  telemetry: createTelemetryApi(),
  engine: createEngineApi(),
  settings: createSettingsApi(),
  ...createWindowApi()
});
