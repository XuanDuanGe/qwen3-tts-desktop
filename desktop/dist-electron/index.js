import { app, BrowserWindow, ipcMain } from "electron";
import { constants, mkdirSync, appendFileSync } from "node:fs";
import { join, basename } from "node:path";
import { access, writeFile, readFile, unlink, mkdir, copyFile, readdir, stat } from "node:fs/promises";
import { spawn, execFile } from "node:child_process";
import { EventEmitter } from "node:events";
const workspaceRoot = join(app.getAppPath(), "..");
function getEnginePaths() {
  if (app.isPackaged) {
    return {
      command: join(process.resourcesPath, "engine", "qwen-tts-engine.exe"),
      args: [],
      cwd: process.resourcesPath,
      appData: app.getPath("userData"),
      cache: app.getPath("cache"),
      packaged: true
    };
  }
  return {
    command: join(workspaceRoot, ".venv", "Scripts", "python.exe"),
    args: ["-m", "qwen_tts_engine", "--device", "cpu", "--dtype", "float32"],
    cwd: join(workspaceRoot, "core"),
    appData: join(workspaceRoot, ".local", "app-data"),
    cache: join(workspaceRoot, ".local", "cache"),
    packaged: false
  };
}
const PROTOCOL_VERSION = 1;
function createRequest(requestId, method, params = {}) {
  return {
    protocolVersion: PROTOCOL_VERSION,
    type: "request",
    requestId,
    method,
    params
  };
}
function parseMessage(line) {
  const message = JSON.parse(line);
  if (message.protocolVersion !== PROTOCOL_VERSION || typeof message.type !== "string") {
    throw new Error("Invalid engine protocol message");
  }
  if (message.type === "response" && typeof message.requestId !== "string") {
    throw new Error("Invalid engine response");
  }
  if (message.type === "event" && typeof message.event !== "string") {
    throw new Error("Invalid engine event");
  }
  return message;
}
const REQUEST_TIMEOUT = 3e4;
const STARTUP_REQUEST_TIMEOUT = 12e4;
const MODEL_INSTALL_TIMEOUT = 30 * 60 * 1e3;
const SHUTDOWN_TIMEOUT = 6e3;
const EXIT_TIMEOUT = 2e3;
const STARTUP_EXIT_TIMEOUT = 15e3;
class EngineManager extends EventEmitter {
  constructor(logger) {
    super();
    this.logger = logger;
    this.child = null;
    this.pending = /* @__PURE__ */ new Map();
    this.sequence = 0;
    this.status = "stopped";
    this.buffer = "";
    this.stopping = false;
    this.ready = false;
    this.stopRequested = false;
    this.startPromise = null;
    this.stopPromise = null;
  }
  async start() {
    if (this.stopping || this.stopRequested) {
      throw new Error("Engine is stopping");
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
    var _a, _b, _c, _d, _e;
    const paths = getEnginePaths();
    (_a = this.logger) == null ? void 0 : _a.info("engine", `starting engine (${paths.packaged ? "packaged" : "development"})`);
    if (!paths.packaged) {
      try {
        await access(paths.command, constants.X_OK);
      } catch {
        const error = new Error(
          `Python engine environment is missing: ${paths.command}. From the repository root, run: python -m venv .venv && .venv/Scripts/python.exe -m pip install -e core`
        );
        (_b = this.logger) == null ? void 0 : _b.error("engine", error.message);
        this.emit("status", this.status, error);
        this.emit("stderr", `${error.message}
`);
        throw error;
      }
    }
    const args = [
      ...paths.args,
      "--app-data-dir",
      paths.appData,
      "--cache-dir",
      paths.cache
    ];
    this.status = "starting";
    this.emit("status", this.status);
    if (this.stopRequested) {
      throw new Error("Engine shutdown requested");
    }
    const child = spawn(paths.command, args, {
      cwd: paths.cwd,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true
    });
    this.child = child;
    (_c = this.logger) == null ? void 0 : _c.info("engine", `sidecar started pid=${child.pid}`);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => this.handleStdout(chunk));
    child.stderr.on("data", (chunk) => {
      if (!this.stopRequested) {
        this.emit("stderr", chunk);
      }
    });
    child.once("error", (error) => {
      if (!this.stopRequested) {
        this.emit(
          "stderr",
          `Failed to start engine (${paths.command}, cwd: ${paths.cwd}): ${error.message}
`
        );
      }
      this.handleExit(child, error);
    });
    child.once("exit", (code, signal) => {
      this.handleExit(
        child,
        new Error(
          `Engine exited with code ${code ?? "unknown"}${signal ? ` (${signal})` : ""}`
        )
      );
    });
    try {
      await this.request("engine.hello", {}, STARTUP_REQUEST_TIMEOUT);
      await this.request("engine.health", {}, STARTUP_REQUEST_TIMEOUT);
      if (this.stopRequested) {
        throw new Error("Engine shutdown requested");
      }
      this.ready = true;
      this.status = "ready";
      (_d = this.logger) == null ? void 0 : _d.info("engine", "engine ready");
      this.emit("status", this.status);
      return this.status;
    } catch (error) {
      if (this.stopRequested) {
        throw error;
      }
      await this.forceStop(child);
      if (!await this.waitForExit(child, STARTUP_EXIT_TIMEOUT)) {
        await this.forceStop(child, true);
        await this.waitForExit(child, EXIT_TIMEOUT);
      }
      this.status = "unavailable";
      (_e = this.logger) == null ? void 0 : _e.error("engine", `startup failed: ${error.message}`);
      this.emit("status", this.status, error);
      throw error;
    }
  }
  request(method, params = {}, timeout = REQUEST_TIMEOUT) {
    var _a, _b, _c;
    if ((this.stopping || this.stopRequested) && method !== "engine.shutdown") {
      return Promise.reject(new Error("Engine is stopping"));
    }
    if (!((_b = (_a = this.child) == null ? void 0 : _a.stdin) == null ? void 0 : _b.writable)) {
      return Promise.reject(new Error("Engine is not running"));
    }
    if (method === "models.install" && timeout === REQUEST_TIMEOUT) {
      timeout = MODEL_INSTALL_TIMEOUT;
    }
    const requestId = `req-${++this.sequence}`;
    const message = `${JSON.stringify(createRequest(requestId, method, params))}
`;
    const startedAt = Date.now();
    (_c = this.logger) == null ? void 0 : _c.debug("engine", `request ${method} started`);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        var _a2;
        this.pending.delete(requestId);
        const phase = method === "engine.hello" || method === "engine.health" ? "startup handshake" : "request";
        (_a2 = this.logger) == null ? void 0 : _a2.error(
          "engine",
          `${phase} ${method} timed out after ${timeout}ms`
        );
        reject(new Error(`Engine request timed out: ${method}`));
      }, timeout);
      this.pending.set(requestId, {
        resolve,
        reject,
        timer,
        method,
        startedAt
      });
      this.child.stdin.write(message, "utf8", (error) => {
        var _a2;
        if (error) {
          clearTimeout(timer);
          this.pending.delete(requestId);
          (_a2 = this.logger) == null ? void 0 : _a2.error("engine", `request ${method} write failed: ${error.message}`);
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
    var _a, _b, _c;
    const child = this.child;
    if (!child) {
      this.ready = false;
      this.status = "stopped";
      return;
    }
    this.stopping = true;
    const wasReady = this.ready;
    if (!wasReady) {
      this.closeStdin(child);
    } else {
      try {
        await this.request("engine.shutdown", {}, SHUTDOWN_TIMEOUT);
      } catch (error) {
        if (this.child === child) {
          (_a = this.logger) == null ? void 0 : _a.warn("engine", `graceful shutdown failed: ${error.message}`);
        }
      }
    }
    const exitTimeout = wasReady ? EXIT_TIMEOUT : STARTUP_EXIT_TIMEOUT;
    if (!await this.waitForExit(child, exitTimeout)) {
      (_b = this.logger) == null ? void 0 : _b.warn("engine", `sidecar did not exit gracefully pid=${child.pid}`);
      await this.forceStop(child);
      if (!await this.waitForExit(child, EXIT_TIMEOUT)) {
        await this.forceStop(child, true);
        if (!await this.waitForExit(child, EXIT_TIMEOUT)) {
          (_c = this.logger) == null ? void 0 : _c.error("engine", `sidecar did not exit after forced stop pid=${child.pid}`);
        }
      }
    }
    this.status = "stopped";
    this.emit("status", this.status);
  }
  handleStdout(chunk) {
    var _a, _b, _c, _d, _e, _f;
    this.buffer += chunk;
    const lines = this.buffer.split(/\r?\n/);
    this.buffer = lines.pop();
    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }
      try {
        const message = parseMessage(line);
        if (message.type === "event") {
          this.emit("event", message);
          continue;
        }
        const pending = this.pending.get(message.requestId);
        if (!pending) {
          continue;
        }
        this.pending.delete(message.requestId);
        clearTimeout(pending.timer);
        if (message.ok) {
          (_a = this.logger) == null ? void 0 : _a.debug(
            "engine",
            `request ${pending.method} succeeded in ${Date.now() - pending.startedAt}ms`
          );
          pending.resolve(message.result);
        } else {
          const error = new Error(
            ((_b = message.error) == null ? void 0 : _b.message) || "Engine request failed"
          );
          error.code = (_c = message.error) == null ? void 0 : _c.code;
          error.details = (_d = message.error) == null ? void 0 : _d.details;
          (_e = this.logger) == null ? void 0 : _e.error(
            "engine",
            `request ${pending.method} failed (${error.code || "unknown"}) in ${Date.now() - pending.startedAt}ms`
          );
          pending.reject(error);
        }
      } catch (error) {
        (_f = this.logger) == null ? void 0 : _f.error("engine", `protocol parse failed: ${error.message}`);
        this.emit("stderr", `${error.message}
`);
      }
    }
  }
  handleExit(child, error) {
    var _a;
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
      this.status = "unavailable";
      (_a = this.logger) == null ? void 0 : _a.error("engine", `sidecar exited: ${error.message}`);
      this.emit("status", this.status, error);
    }
  }
  closeStdin(child) {
    if (child.stdin && !child.stdin.destroyed && !child.stdin.writableEnded) {
      child.stdin.end();
    }
  }
  waitForExit(child, timeout) {
    if (this.child !== child) {
      return Promise.resolve(true);
    }
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        child.removeListener("exit", onExit);
        resolve(this.child !== child);
      }, timeout);
      const onExit = () => {
        clearTimeout(timer);
        resolve(true);
      };
      child.once("exit", onExit);
    });
  }
  async forceStop(child, force = false) {
    if (this.child !== child || !child.pid) {
      return;
    }
    if (process.platform === "win32") {
      await new Promise((resolve) => {
        execFile(
          "taskkill",
          ["/PID", String(child.pid), "/T", "/F"],
          { windowsHide: true },
          (error) => {
            var _a;
            if (error) {
              (_a = this.logger) == null ? void 0 : _a.warn("engine", `taskkill failed: ${error.message}`);
            }
            resolve();
          }
        );
      });
      return;
    }
    if (!child.killed) {
      child.kill(force ? "SIGKILL" : "SIGTERM");
    }
  }
}
function registerEngineEvents(engine, logger, getWindow2) {
  function send(channel, payload) {
    const window = getWindow2();
    if (!window || window.isDestroyed() || window.webContents.isDestroyed()) {
      return;
    }
    try {
      window.webContents.send(channel, payload);
    } catch {
    }
  }
  engine.on("status", (status) => {
    send("engine:status-changed", status);
  });
  engine.on("event", (message) => {
    logger.debug("engine", `event ${message.event}`);
    const channel = {
      "job.updated": "engine:job-updated",
      "artifact.created": "engine:artifact-created"
    }[message.event];
    if (!channel) {
      return;
    }
    if (message.event === "artifact.created") {
      logger.info("artifact", "artifact created received; forwarding to renderer");
    }
    send(channel, message.payload);
    if (message.event === "artifact.created") {
      logger.info("artifact", "artifact forwarded to renderer for preview");
    }
  });
  engine.on("stderr", (message) => {
    for (const line of message.split(/\r?\n/)) {
      if (line.trim()) logger.warn("python", line.trim());
    }
  });
}
function getWindow(event) {
  return BrowserWindow.fromWebContents(event.sender);
}
function validateSender(event) {
  const window = getWindow(event);
  if (!window || window.isDestroyed()) {
    throw new Error("Invalid renderer window");
  }
  return window;
}
function getManager(event, manager) {
  validateSender(event);
  return manager;
}
function requireString(value, name) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} must be a non-empty string`);
  }
  return value.trim();
}
function requireArtifactId(value) {
  const artifactId = requireString(value, "artifactId");
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(artifactId)) {
    throw new Error("artifactId must be a UUID");
  }
  return artifactId;
}
function requireObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
  return value;
}
function getDefaultSettings() {
  return {
    modelDownloadProxy: "http://127.0.0.1:7897",
    audioDownloadDir: join(app.getPath("music"), "qwen3-tts-downloads")
  };
}
function getConfigPath() {
  return join(app.getPath("userData"), "config.json");
}
async function readSettings() {
  try {
    const raw = await readFile(getConfigPath(), "utf8");
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return getDefaultSettings();
  }
}
function normalizeSettings(value) {
  const defaults = getDefaultSettings();
  const source = value && typeof value === "object" ? value : {};
  const modelDownloadProxy = typeof source.modelDownloadProxy === "string" ? source.modelDownloadProxy.trim() : defaults.modelDownloadProxy;
  const audioDownloadDir = typeof source.audioDownloadDir === "string" && source.audioDownloadDir.trim() ? source.audioDownloadDir.trim() : defaults.audioDownloadDir;
  return {
    modelDownloadProxy,
    audioDownloadDir
  };
}
function registerSettingsHandlers() {
  ipcMain.handle("settings:get", async (event) => {
    validateSender(event);
    return readSettings();
  });
  ipcMain.handle("settings:save", async (event, settings) => {
    validateSender(event);
    const nextSettings = normalizeSettings(requireObject(settings, "settings"));
    await writeFile(
      getConfigPath(),
      `${JSON.stringify(nextSettings, null, 2)}
`,
      "utf8"
    );
    return nextSettings;
  });
}
function pad(value) {
  return String(value).padStart(2, "0");
}
function formatDownloadFileName(date = /* @__PURE__ */ new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}-${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}.wav`;
}
function getOutputsDir() {
  return join(getEnginePaths().appData, "outputs");
}
function getArtifactJsonPath(artifactId) {
  return join(getOutputsDir(), `${artifactId}.json`);
}
function getArtifactAudioPath(fileName) {
  return join(getOutputsDir(), fileName);
}
async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}
async function buildRecord(artifactId, fileName, meta, fileStat) {
  return {
    artifactId,
    fileName,
    mimeType: typeof (meta == null ? void 0 : meta.mimeType) === "string" ? meta.mimeType : "audio/wav",
    sampleRate: typeof (meta == null ? void 0 : meta.sampleRate) === "number" ? meta.sampleRate : void 0,
    createdAt: typeof (meta == null ? void 0 : meta.createdAt) === "number" ? meta.createdAt : fileStat.mtimeMs
  };
}
async function loadArtifactRecord(artifactId) {
  const metaPath = getArtifactJsonPath(artifactId);
  const meta = await readJson(metaPath);
  if (meta) {
    const configuredName = typeof meta.fileName === "string" && meta.fileName.trim() ? meta.fileName.trim() : `${artifactId}.wav`;
    if (basename(configuredName) !== configuredName || !configuredName.endsWith(".wav")) {
      return null;
    }
    const fileName = configuredName;
    const audioPath = getArtifactAudioPath(fileName);
    try {
      await access(audioPath, constants.R_OK);
      return buildRecord(
        typeof meta.artifactId === "string" && meta.artifactId.trim() ? meta.artifactId.trim() : artifactId,
        fileName,
        meta,
        await stat(audioPath)
      );
    } catch {
      return null;
    }
  }
  const fallbackName = `${artifactId}.wav`;
  const fallbackPath = getArtifactAudioPath(fallbackName);
  try {
    await access(fallbackPath, constants.R_OK);
    return buildRecord(
      artifactId,
      fallbackName,
      null,
      await stat(fallbackPath)
    );
  } catch {
    return null;
  }
}
async function listArtifactRecords() {
  await mkdir(getOutputsDir(), { recursive: true });
  const entries = await readdir(getOutputsDir(), { withFileTypes: true });
  const records = [];
  const seenFiles = /* @__PURE__ */ new Set();
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json") || entry.name.endsWith(".tmp.json")) {
      continue;
    }
    const artifactId = entry.name.replace(/\.json$/i, "");
    if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(artifactId)) {
      continue;
    }
    const record = await loadArtifactRecord(artifactId);
    if (!record) {
      continue;
    }
    records.push(record);
    seenFiles.add(record.fileName);
  }
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".wav") || entry.name.endsWith(".tmp.wav") || seenFiles.has(entry.name)) {
      continue;
    }
    const filePath = getArtifactAudioPath(entry.name);
    const fileStat = await stat(filePath);
    records.push(
      await buildRecord(
        entry.name.replace(/\.wav$/i, ""),
        entry.name,
        null,
        fileStat
      )
    );
  }
  records.sort((left, right) => (right.createdAt || 0) - (left.createdAt || 0));
  return records;
}
function registerArtifactHandlers(manager) {
  ipcMain.handle("artifacts:list", async (event) => {
    validateSender(event);
    return { artifacts: await listArtifactRecords() };
  });
  ipcMain.handle("artifacts:get", async (event, artifactId) => {
    getManager(event, manager);
    const record = await loadArtifactRecord(requireArtifactId(artifactId));
    if (!record) {
      throw new Error("Artifact not found");
    }
    return record;
  });
  ipcMain.handle("artifacts:delete", async (event, artifactId) => {
    getManager(event, manager);
    const normalizedArtifactId = requireArtifactId(artifactId);
    const record = await loadArtifactRecord(normalizedArtifactId);
    if (!record) {
      throw new Error("Artifact not found");
    }
    await Promise.all([
      unlink(getArtifactAudioPath(record.fileName)).catch(() => void 0),
      unlink(getArtifactJsonPath(normalizedArtifactId)).catch(() => void 0)
    ]);
    return { deleted: true };
  });
  ipcMain.handle("artifacts:read", async (event, artifactId) => {
    validateSender(event);
    const record = await loadArtifactRecord(requireArtifactId(artifactId));
    if (!record) {
      throw new Error("Artifact not found");
    }
    return readFile(getArtifactAudioPath(record.fileName));
  });
  ipcMain.handle("artifacts:download", async (event, artifactId) => {
    validateSender(event);
    const normalizedArtifactId = requireArtifactId(artifactId);
    const record = await loadArtifactRecord(normalizedArtifactId);
    if (!record) {
      throw new Error("Artifact not found");
    }
    const settings = await readSettings();
    const downloadDir = settings.audioDownloadDir;
    const fileName = formatDownloadFileName();
    const target = join(downloadDir, fileName);
    await mkdir(downloadDir, { recursive: true });
    await copyFile(getArtifactAudioPath(record.fileName), target);
    return { fileName, target };
  });
}
function requireProxy(value) {
  if (value == null || value === "") return void 0;
  if (typeof value !== "string") {
    throw new Error("proxy must be a string");
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("proxy must be a valid URL");
  }
  if (!["http:", "https:"].includes(url.protocol) || !url.hostname || !url.port) {
    throw new Error("proxy must use http://host:port or https://host:port");
  }
  return value;
}
function registerEngineHandlers(manager) {
  ipcMain.handle("engine:status", (event) => {
    getManager(event, manager);
    return manager.status;
  });
  ipcMain.handle("models:list", (event) => {
    getManager(event, manager);
    return manager.request("models.list");
  });
  ipcMain.handle("models:capabilities", (event, modelId) => {
    getManager(event, manager);
    return manager.request("models.capabilities", {
      modelId: requireString(modelId, "modelId")
    });
  });
  ipcMain.handle("models:install", (event, params) => {
    getManager(event, manager);
    const input = requireObject(params, "params");
    return manager.request("models.install", {
      modelId: requireString(input.modelId, "modelId"),
      proxy: requireProxy(input.proxy)
    });
  });
  ipcMain.handle("jobs:submit", (event, params) => {
    getManager(event, manager);
    return manager.request("jobs.submit", requireObject(params, "params"));
  });
  ipcMain.handle("jobs:get", (event, jobId) => {
    getManager(event, manager);
    return manager.request("jobs.get", {
      jobId: requireString(jobId, "jobId")
    });
  });
  ipcMain.handle("jobs:cancel", (event, jobId) => {
    getManager(event, manager);
    return manager.request("jobs.cancel", {
      jobId: requireString(jobId, "jobId")
    });
  });
}
function registerGreetHandler() {
  ipcMain.handle("greet", (_, name) => `你好，${name}！`);
}
const TELEMETRY_EVENTS = /* @__PURE__ */ new Set([
  "app_started",
  "engine_bootstrap_started",
  "engine_ready",
  "engine_unavailable",
  "page_view",
  "component_used",
  "model_capabilities_requested",
  "generation_submitted",
  "generation_succeeded",
  "generation_failed",
  "artifact_downloaded",
  "artifact_preview_ready"
]);
const TELEMETRY_ROUTES = /* @__PURE__ */ new Set([
  "home",
  "voice_generate",
  "voice_clone",
  "audio_files",
  "settings"
]);
const TELEMETRY_COMPONENTS = /* @__PURE__ */ new Set([
  "engine_bootstrap",
  "sidebar",
  "title_bar",
  "home_page",
  "voice_generate_page",
  "voice_clone_page",
  "audio_files_page",
  "settings_page"
]);
function validateProperties(event, properties = {}) {
  if (!properties || typeof properties !== "object" || Array.isArray(properties)) {
    throw new Error("telemetry properties must be an object");
  }
  const result = {};
  for (const [key, value] of Object.entries(properties)) {
    if (typeof key !== "string" || key.length > 32 || typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean" || typeof value === "string" && value.length > 80) {
      throw new Error("invalid telemetry property");
    }
    result[key] = value;
  }
  if (event === "page_view" && !TELEMETRY_ROUTES.has(result.route)) {
    throw new Error("invalid telemetry route");
  }
  if (event === "component_used" && !TELEMETRY_COMPONENTS.has(result.component)) {
    throw new Error("invalid telemetry component");
  }
  return result;
}
function registerTelemetryHandler(logger) {
  ipcMain.handle("telemetry:track", (event, name, properties) => {
    if (typeof name !== "string" || !TELEMETRY_EVENTS.has(name)) {
      throw new Error("invalid telemetry event");
    }
    const safeProperties = validateProperties(name, properties);
    logger.info("telemetry", `${name} ${JSON.stringify(safeProperties)}`);
    return { tracked: true };
  });
}
function registerWindowControlHandlers() {
  ipcMain.handle("window:minimize", (event) => {
    var _a;
    (_a = getWindow(event)) == null ? void 0 : _a.minimize();
  });
  ipcMain.handle("window:toggle-maximize", (event) => {
    const window = getWindow(event);
    if (!window) {
      return false;
    }
    if (window.isMaximized()) {
      window.unmaximize();
      return false;
    }
    window.maximize();
    return true;
  });
  ipcMain.handle("window:close", (event) => {
    var _a;
    (_a = getWindow(event)) == null ? void 0 : _a.close();
  });
  ipcMain.handle("window:is-maximized", (event) => {
    var _a;
    return ((_a = getWindow(event)) == null ? void 0 : _a.isMaximized()) ?? false;
  });
}
function registerHandlers(engine, logger) {
  registerGreetHandler();
  registerEngineHandlers(engine);
  registerArtifactHandlers(engine);
  registerSettingsHandlers();
  registerWindowControlHandlers();
  registerTelemetryHandler(logger);
}
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
function timestamp(date = /* @__PURE__ */ new Date()) {
  const pad2 = (value, size = 2) => String(value).padStart(size, "0");
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}-${pad2(date.getHours())}-${pad2(date.getMinutes())}-${pad2(date.getSeconds())}`;
}
function lineTimestamp(date = /* @__PURE__ */ new Date()) {
  return `${timestamp(date)}.${String(date.getMilliseconds()).padStart(3, "0")}`;
}
function createLogger(appData, level = process.env.QWEN_TTS_LOG_LEVEL || "info") {
  const threshold = LEVELS[level] || LEVELS.info;
  const logsDir = join(appData, "logs");
  const filePath = join(logsDir, `${timestamp()}.log`);
  let ready = false;
  try {
    mkdirSync(logsDir, { recursive: true });
    ready = true;
  } catch (error) {
    console.error(`[logger] unable to create log directory: ${error.message}`);
  }
  function write(name, module, message) {
    if (LEVELS[name] < threshold) return;
    const line = `${lineTimestamp()} [${name.toUpperCase()}] [${module}] ${message}`;
    if (name === "error") console.error(line);
    else if (name === "warn") console.warn(line);
    else console.log(line);
    if (ready) {
      try {
        appendFileSync(filePath, `${line}
`, "utf8");
      } catch (error) {
        ready = false;
        console.error(`[logger] unable to write log file: ${error.message}`);
      }
    }
  }
  return {
    filePath,
    debug: (module, message) => write("debug", module, message),
    info: (module, message) => write("info", module, message),
    warn: (module, message) => write("warn", module, message),
    error: (module, message) => write("error", module, message)
  };
}
function createWindow() {
  const window = new BrowserWindow({
    title: "Qwen3 TTS Desktop",
    width: 1024,
    height: 768,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    webPreferences: {
      preload: join(import.meta.dirname, "index.mjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true
    }
  });
  if (process.env.VITE_DEV_SERVER_URL) {
    window.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    window.loadFile(join(import.meta.dirname, "../../dist/index.html"));
  }
  return window;
}
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  const enginePaths = getEnginePaths();
  const sessionDataPath = join(enginePaths.appData, "session-data");
  mkdirSync(enginePaths.appData, { recursive: true });
  mkdirSync(enginePaths.cache, { recursive: true });
  mkdirSync(sessionDataPath, { recursive: true });
  app.setPath("userData", enginePaths.appData);
  app.setPath("cache", enginePaths.cache);
  app.setPath("sessionData", sessionDataPath);
  const logger = createLogger(enginePaths.appData);
  const engine = new EngineManager(logger);
  let mainWindow;
  let shutdownPromise;
  let quitRequested = false;
  let quitApproved = false;
  app.on("second-instance", () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
  });
  app.whenReady().then(async () => {
    if (quitRequested) {
      return;
    }
    logger.info("app", "application ready");
    registerHandlers(engine, logger);
    registerEngineEvents(engine, logger, () => mainWindow);
    mainWindow = createWindow();
    try {
      await engine.start();
    } catch (error) {
      if (!quitRequested) {
        logger.error("app", `engine startup failed: ${error.message}`);
      }
    }
    if (quitRequested) {
      return;
    }
    app.on("activate", () => {
      if (!mainWindow || mainWindow.isDestroyed()) {
        mainWindow = createWindow();
      }
    });
  });
  app.on("before-quit", (event) => {
    quitRequested = true;
    if (quitApproved) {
      return;
    }
    event.preventDefault();
    if (shutdownPromise) {
      return;
    }
    logger.info("app", "application quitting");
    shutdownPromise = engine.stop().catch((error) => {
      logger.error("app", `engine shutdown failed: ${error.message}`);
    });
    shutdownPromise.finally(() => {
      quitApproved = true;
      app.quit();
    });
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}
