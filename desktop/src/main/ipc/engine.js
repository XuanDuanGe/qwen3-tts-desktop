import { ipcMain } from 'electron';
import { getManager, requireObject, requireString } from './common.js';

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
}
