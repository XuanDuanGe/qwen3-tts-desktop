import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { getEnginePaths } from './paths.js';
import { createRequest, parseMessage } from './protocol.js';

const REQUEST_TIMEOUT = 30000;
const MODEL_INSTALL_TIMEOUT = 30 * 60 * 1000;
const SHUTDOWN_TIMEOUT = 3000;

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
  }

  async start() {
    if (this.child) {
      return this.status;
    }

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
    this.child = spawn(paths.command, args, {
      cwd: paths.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    this.logger?.info('engine', `sidecar started pid=${this.child.pid}`);
    this.child.stdout.setEncoding('utf8');
    this.child.stderr.setEncoding('utf8');
    this.child.stdout.on('data', (chunk) => this.handleStdout(chunk));
    this.child.stderr.on('data', (chunk) => this.emit('stderr', chunk));
    this.child.once('error', (error) => {
      this.emit(
        'stderr',
        `Failed to start engine (${paths.command}, cwd: ${paths.cwd}): ${error.message}\n`,
      );
      this.handleExit(error);
    });
    this.child.once('exit', (code, signal) => {
      this.handleExit(
        new Error(
          `Engine exited with code ${code ?? 'unknown'}${signal ? ` (${signal})` : ''}`,
        ),
      );
    });

    try {
      await this.request('engine.hello');
      await this.request('engine.health');
      this.status = 'ready';
      this.logger?.info('engine', 'engine ready');
      this.emit('status', this.status);
      return this.status;
    } catch (error) {
      this.stopChild();
      this.status = 'unavailable';
      this.logger?.error('engine', `startup failed: ${error.message}`);
      this.emit('status', this.status, error);
      throw error;
    }
  }

  request(method, params = {}, timeout = REQUEST_TIMEOUT) {
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
        this.logger?.error('engine', `request ${method} timed out after ${timeout}ms`);
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

  async stop() {
    if (!this.child) {
      this.status = 'stopped';
      return;
    }

    this.stopping = true;
    try {
      await this.request('engine.shutdown', {}, SHUTDOWN_TIMEOUT);
    } catch {
      this.stopChild();
    }
    this.stopChild();
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

  handleExit(error) {
    if (!this.child) {
      return;
    }
    this.child = null;
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

  stopChild() {
    if (this.child && !this.child.killed) {
      this.child.kill();
    }
    this.child = null;
  }
}
