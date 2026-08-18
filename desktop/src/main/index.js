import { app } from 'electron';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import EngineManager from './engine/manager.js';
import { getEnginePaths } from './engine/paths.js';
import { registerEngineEvents } from './engine/registerEngineEvents.js';
import { registerHandlers } from './ipc/registerHandlers.js';
import { createLogger } from './logger.js';
import { createWindow } from './window/createWindow.js';

const enginePaths = getEnginePaths();
const sessionDataPath = join(enginePaths.appData, 'session-data');
mkdirSync(enginePaths.appData, { recursive: true });
mkdirSync(enginePaths.cache, { recursive: true });
mkdirSync(sessionDataPath, { recursive: true });
app.setPath('userData', enginePaths.appData);
app.setPath('cache', enginePaths.cache);
app.setPath('sessionData', sessionDataPath);

const logger = createLogger(enginePaths.appData);
const engine = new EngineManager(logger);
let mainWindow;
let quitting = false;

app.whenReady().then(async () => {
  logger.info('app', 'application ready');
  registerHandlers(engine, logger);
  registerEngineEvents(engine, logger, () => mainWindow);
  mainWindow = createWindow();
  try {
    await engine.start();
  } catch (error) {
    logger.error('app', `engine startup failed: ${error.message}`);
  }
  app.on('activate', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      mainWindow = createWindow();
    }
  });
});

app.on('before-quit', async (event) => {
  if (quitting) {
    return;
  }
  event.preventDefault();
  quitting = true;
  logger.info('app', 'application quitting');
  await engine.stop();
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
