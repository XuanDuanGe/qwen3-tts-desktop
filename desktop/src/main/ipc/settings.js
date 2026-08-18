import { app, ipcMain } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { requireObject, validateSender } from './common.js';

function getDefaultSettings() {
  return {
    modelDownloadProxy: 'http://127.0.0.1:7897',
    audioDownloadDir: join(app.getPath('music'), 'qwen3-tts-downloads'),
  };
}

function getConfigPath() {
  return join(app.getPath('userData'), 'config.json');
}

export async function readSettings() {
  try {
    const raw = await readFile(getConfigPath(), 'utf8');
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return getDefaultSettings();
  }
}

function normalizeSettings(value) {
  const defaults = getDefaultSettings();
  const source = value && typeof value === 'object' ? value : {};
  const modelDownloadProxy =
    typeof source.modelDownloadProxy === 'string'
      ? source.modelDownloadProxy.trim()
      : defaults.modelDownloadProxy;
  const audioDownloadDir =
    typeof source.audioDownloadDir === 'string' && source.audioDownloadDir.trim()
      ? source.audioDownloadDir.trim()
      : defaults.audioDownloadDir;
  return {
    modelDownloadProxy,
    audioDownloadDir,
  };
}

export function registerSettingsHandlers() {
  ipcMain.handle('settings:get', async (event) => {
    validateSender(event);
    return readSettings();
  });

  ipcMain.handle('settings:save', async (event, settings) => {
    validateSender(event);
    const nextSettings = normalizeSettings(requireObject(settings, 'settings'));
    await writeFile(
      getConfigPath(),
      `${JSON.stringify(nextSettings, null, 2)}\n`,
      'utf8',
    );
    return nextSettings;
  });
}
