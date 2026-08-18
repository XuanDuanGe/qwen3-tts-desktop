import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { execFile, spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { getEnginePaths } from './paths.js';
import { createRequest, parseMessage } from './protocol.js';

const REQUEST_TIMEOUT = 30000;
const STARTUP_REQUEST_TIMEOUT = 120000;
const MODEL_INSTALL_TIMEOUT = 30 * 60 * 1000;
const SHUTDOWN_TIMEOUT = 6000;
const EXIT_TIMEOUT = 2000;
const STARTUP_EXIT_TIMEOUT = 15000;

export default class EngineManager extends EventEmitter {
  constructor(logger) {
    super();
    this.logger = logger;
    this.child = null;
    this.pending = new Map();
    this.sequence = 0;
    this.status = 'stopped';
    this.buffer = '';
    this.stopping = false;
    this.ready = false;
    this.stopRequested = false;
    this.startPromise = null;
    this.stopPromise = null;
  }

  async start() {
    if (this.stopping || this.stopRequested) {
      throw new Error('Engine is stopping');
    }
    if (this.child) {
      return this.status;
    }
    if (this.startPromise) {
      return this.startPromise;
    }
    this.startPromise = this.startEngine();
    try {
      return await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }

  async startEngine() {
    const paths = getEnginePaths();
    this.logger?.info('engine', `starting engine (${paths.packaged ? 'packaged' : 'development'})`);
    if (!paths.packaged) {
      try {
        await access(paths.command, constants.X_OK);
      } catch {
        const error = new Error(
          `Python engine environment is missing: ${paths.command}. ` +
            'From the repository root, run: python -m venv .venv && ' +
            '.venv/Scripts/python.exe -m pip install -e core',
        );
        this.logger?.error('engine', error.message);
        this.emit('status', this.status, error);
        this.emit('stderr', `${error.message}\n`);
        throw error;
      }
    }
    const args = [
      ...paths.args,
      '--app-data-dir',
      paths.appData,
      '--cache-dir',
      paths.cache,
    ];

    this.status = 'starting';
    this.emit('status', this.status);
    if (this.stopRequested) {
      throw new Error('Engine shutdown requested');
    }
    const child = spawn(paths.command, args, {
      cwd: paths.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    this.child = child;
    this.logger?.info('engine', `sidecar started pid=${child.pid}`);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => this.handleStdout(chunk));
    child.stderr.on('data', (chunk) => {
      if (!this.stopRequested) {
        this.emit('stderr', chunk);
      }
    });
    child.once('error', (error) => {
      if (!this.stopRequested) {
        this.emit(
          'stderr',
          `Failed to start engine (${paths.command}, cwd: ${paths.cwd}): ${error.message}\n`,
        );
      }
      this.handleExit(child, error);
    });
    child.once('exit', (code, signal) => {
      this.handleExit(
        child,
        new Error(
          `Engine exited with code ${code ?? 'unknown'}${signal ? ` (${signal})` : ''}`,
        ),
      );
    });

    try {
      await this.request('engine.hello', {}, STARTUP_REQUEST_TIMEOUT);
      await this.request('engine.health', {}, STARTUP_REQUEST_TIMEOUT);
      if (this.stopRequested) {
        throw new Error('Engine shutdown requested');
      }
      this.ready = true;
      this.status = 'ready';
      this.logger?.info('engine', 'engine ready');
      this.emit('status', this.status);
      return this.status;
    } catch (error) {
      if (this.stopRequested) {
        throw error;
      }
      await this.forceStop(child);
      if (!(await this.waitForExit(child, STARTUP_EXIT_TIMEOUT))) {
        await this.forceStop(child, true);
        await this.waitForExit(child, EXIT_TIMEOUT);
      }
      this.status = 'unavailable';
      this.logger?.error('engine', `startup failed: ${error.message}`);
      this.emit('status', this.status, error);
      throw error;
    }
  }

  request(method, params = {}, timeout = REQUEST_TIMEOUT) {
    if ((this.stopping || this.stopRequested) && method !== 'engine.shutdown') {
      return Promise.reject(new Error('Engine is stopping'));
    }
    if (!this.child?.stdin?.writable) {
      return Promise.reject(new Error('Engine is not running'));
    }
    if (method === 'models.install' && timeout === REQUEST_TIMEOUT) {
      timeout = MODEL_INSTALL_TIMEOUT;
    }

    const requestId = `req-${++this.sequence}`;
    const message = `${JSON.stringify(createRequest(requestId, method, params))}\n`;
    const startedAt = Date.now();
    this.logger?.debug('engine', `request ${method} started`);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        const phase =
          method === 'engine.hello' || method === 'engine.health'
            ? 'startup handshake'
            : 'request';
        this.logger?.error(
          'engine',
          `${phase} ${method} timed out after ${timeout}ms`,
        );
        reject(new Error(`Engine request timed out: ${method}`));
      }, timeout);
      this.pending.set(requestId, {
        resolve,
        reject,
        timer,
        method,
        startedAt,
      });
      this.child.stdin.write(message, 'utf8', (error) => {
        if (error) {
          clearTimeout(timer);
          this.pending.delete(requestId);
          this.logger?.error('engine', `request ${method} write failed: ${error.message}`);
          reject(error);
        }
      });
    });
  }

  stop() {
    this.stopRequested = true;
    if (!this.stopPromise) {
      this.stopPromise = this.stopEngine();
    }
    return this.stopPromise;
  }

  async stopEngine() {
    const child = this.child;
    if (!child) {
      this.ready = false;
      this.status = 'stopped';
      return;
    }

    this.stopping = true;
    const wasReady = this.ready;
    if (!wasReady) {
      this.closeStdin(child);
    } else {
      try {
        await this.request('engine.shutdown', {}, SHUTDOWN_TIMEOUT);
      } catch (error) {
        if (this.child === child) {
          this.logger?.warn('engine', `graceful shutdown failed: ${error.message}`);
        }
      }
    }

    const exitTimeout = wasReady ? EXIT_TIMEOUT : STARTUP_EXIT_TIMEOUT;
    if (!(await this.waitForExit(child, exitTimeout))) {
      this.logger?.warn('engine', `sidecar did not exit gracefully pid=${child.pid}`);
      await this.forceStop(child);
      if (!(await this.waitForExit(child, EXIT_TIMEOUT))) {
        await this.forceStop(child, true);
        if (!(await this.waitForExit(child, EXIT_TIMEOUT))) {
          this.logger?.error('engine', `sidecar did not exit after forced stop pid=${child.pid}`);
        }
      }
    }

    this.status = 'stopped';
    this.emit('status', this.status);
  }

  handleStdout(chunk) {
    this.buffer += chunk;
    const lines = this.buffer.split(/\r?\n/);
    this.buffer = lines.pop();
    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }
      try {
        const message = parseMessage(line);
        if (message.type === 'event') {
          this.emit('event', message);
          continue;
        }
        const pending = this.pending.get(message.requestId);
        if (!pending) {
          continue;
        }
        this.pending.delete(message.requestId);
        clearTimeout(pending.timer);
        if (message.ok) {
          this.logger?.debug(
            'engine',
            `request ${pending.method} succeeded in ${Date.now() - pending.startedAt}ms`,
          );
          pending.resolve(message.result);
        } else {
          const error = new Error(
            message.error?.message || 'Engine request failed',
          );
          error.code = message.error?.code;
          error.details = message.error?.details;
          this.logger?.error(
            'engine',
            `request ${pending.method} failed (${error.code || 'unknown'}) in ${Date.now() - pending.startedAt}ms`,
          );
          pending.reject(error);
        }
      } catch (error) {
        this.logger?.error('engine', `protocol parse failed: ${error.message}`);
        this.emit('stderr', `${error.message}\n`);
      }
    }
  }

  handleExit(child, error) {
    if (this.child !== child) {
      return;
    }
    this.child = null;
    this.ready = false;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
    if (!this.stopping) {
      this.status = 'unavailable';
      this.logger?.error('engine', `sidecar exited: ${error.message}`);
      this.emit('status', this.status, error);
    }
  }

  closeStdin(child) {
    if (
      child.stdin &&
      !child.stdin.destroyed &&
      !child.stdin.writableEnded
    ) {
      child.stdin.end();
    }
  }

  waitForExit(child, timeout) {
    if (this.child !== child) {
      return Promise.resolve(true);
    }
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        child.removeListener('exit', onExit);
        resolve(this.child !== child);
      }, timeout);
      const onExit = () => {
        clearTimeout(timer);
        resolve(true);
      };
      child.once('exit', onExit);
    });
  }

  async forceStop(child, force = false) {
    if (this.child !== child || !child.pid) {
      return;
    }
    if (process.platform === 'win32') {
      await new Promise((resolve) => {
        execFile(
          'taskkill',
          ['/PID', String(child.pid), '/T', '/F'],
          { windowsHide: true },
          (error) => {
            if (error) {
              this.logger?.warn('engine', `taskkill failed: ${error.message}`);
            }
            resolve();
          },
        );
      });
      return;
    }
    if (!child.killed) {
      child.kill(force ? 'SIGKILL' : 'SIGTERM');
    }
  }
}
