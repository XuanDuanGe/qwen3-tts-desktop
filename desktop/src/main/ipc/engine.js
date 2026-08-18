import { BrowserWindow, ipcMain } from 'electron';

function getManager(event, manager) {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || window.isDestroyed()) {
    throw new Error('Invalid renderer window');
  }
  return manager;
}

function requireString(value, name) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${name} must be a non-empty string`);
  }
  return value;
}

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
  return value;
}

function requireProxy(value) {
  if (value == null || value === '') return undefined;
  if (typeof value !== 'string') {
    throw new Error('proxy must be a string');
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('proxy must be a valid URL');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    !url.hostname ||
    !url.port
  ) {
    throw new Error('proxy must use http://host:port or https://host:port');
  }
  return value;
}

export function registerEngineHandlers(manager) {
  ipcMain.handle('engine:status', (event) => {
    getManager(event, manager);
    return manager.status;
  });

  ipcMain.handle('models:list', (event) => {
    getManager(event, manager);
    return manager.request('models.list');
  });

  ipcMain.handle('models:capabilities', (event, modelId) => {
    getManager(event, manager);
    return manager.request('models.capabilities', {
      modelId: requireString(modelId, 'modelId'),
    });
  });

  ipcMain.handle('models:install', (event, params) => {
    getManager(event, manager);
    const input = requireObject(params, 'params');
    return manager.request('models.install', {
      modelId: requireString(input.modelId, 'modelId'),
      proxy: requireProxy(input.proxy),
    });
  });

  ipcMain.handle('jobs:submit', (event, params) => {
    getManager(event, manager);
    return manager.request('jobs.submit', requireObject(params, 'params'));
  });

  ipcMain.handle('jobs:get', (event, jobId) => {
    getManager(event, manager);
    return manager.request('jobs.get', {
      jobId: requireString(jobId, 'jobId'),
    });
  });

  ipcMain.handle('jobs:cancel', (event, jobId) => {
    getManager(event, manager);
    return manager.request('jobs.cancel', {
      jobId: requireString(jobId, 'jobId'),
    });
  });

  ipcMain.handle('artifacts:get', (event, artifactId) => {
    getManager(event, manager);
    return manager.request('artifacts.get', {
      artifactId: requireString(artifactId, 'artifactId'),
    });
  });

  ipcMain.handle('artifacts:delete', (event, artifactId) => {
    getManager(event, manager);
    return manager.request('artifacts.delete', {
      artifactId: requireString(artifactId, 'artifactId'),
    });
  });
}
