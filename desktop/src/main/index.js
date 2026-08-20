import { app } from 'electron';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import EngineManager from './engine/manager.js';
import { getEnginePaths } from './engine/paths.js';
import { registerEngineEvents } from './engine/registerEngineEvents.js';
import { registerHandlers } from './ipc/registerHandlers.js';
import { createLogger } from './logger.js';
import { createWindow } from './window/createWindow.js';

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
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
  let shutdownPromise;
  let quitRequested = false;
  let quitApproved = false;

  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    if (quitRequested) {
      return;
    }
    logger.info('app', 'application ready');
    registerHandlers(engine, logger);
    registerEngineEvents(engine, logger, () => mainWindow);
    mainWindow = createWindow();
    void engine.start().catch((error) => {
      if (!quitRequested) {
        logger.error('app', `engine startup failed: ${error.message}`);
      }
    });

    app.on('activate', () => {
      if (!mainWindow || mainWindow.isDestroyed()) {
        mainWindow = createWindow();
      }
    });
  });

  app.on('before-quit', (event) => {
    quitRequested = true;
    if (quitApproved) {
      return;
    }
    event.preventDefault();
    if (shutdownPromise) {
      return;
    }
    logger.info('app', 'application quitting');
    shutdownPromise = engine.stop().catch((error) => {
      logger.error('app', `engine shutdown failed: ${error.message}`);
    });
    shutdownPromise.finally(() => {
      quitApproved = true;
      app.quit();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
