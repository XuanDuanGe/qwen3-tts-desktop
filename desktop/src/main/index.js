import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import EngineManager from './engine/manager.js';
import { getEnginePaths } from './engine/paths.js';
import { createLogger } from './logger.js';
import { registerGreetHandler } from './ipc/greet.js';
import { registerEngineHandlers } from './ipc/engine.js';
import { registerArtifactHandlers } from './ipc/artifacts.js';
import { registerTelemetryHandler } from './ipc/telemetry.js';
import { registerWindowControlHandlers } from './ipc/windowControls.js';

const logger = createLogger(getEnginePaths().appData);
const engine = new EngineManager(logger);
let mainWindow;
let quitting = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'Qwen3 TTS Desktop',
    width: 1024,
    height: 768,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    webPreferences: {
      preload: join(import.meta.dirname, 'index.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(join(import.meta.dirname, '../../dist/index.html'));
  }
}

app.whenReady().then(async () => {
  logger.info('app', 'application ready');
  registerGreetHandler();
  registerEngineHandlers(engine);
  registerArtifactHandlers();
  registerWindowControlHandlers();
  registerTelemetryHandler(logger);
  engine.on('status', (status) =>
    mainWindow?.webContents.send('engine:status-changed', status),
  );
  engine.on('event', (message) => {
    logger.debug('engine', `event ${message.event}`);
    const channel = {
      'job.updated': 'engine:job-updated',
      'artifact.created': 'engine:artifact-created',
    }[message.event];
    if (channel) {
      if (message.event === 'artifact.created') {
        logger.info('artifact', 'artifact created received; forwarding to renderer');
      }
      mainWindow?.webContents.send(channel, message.payload);
      if (message.event === 'artifact.created') {
        logger.info('artifact', 'artifact forwarded to renderer for preview');
      }
    }
  });
  engine.on('stderr', (message) => {
    for (const line of message.split(/\r?\n/)) {
      if (line.trim()) logger.warn('python', line.trim());
    }
  });
  createWindow();
  try {
    await engine.start();
  } catch (error) {
    logger.error('app', `engine startup failed: ${error.message}`);
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
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
