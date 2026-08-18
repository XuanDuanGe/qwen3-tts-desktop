import { app, ipcMain, BrowserWindow } from "electron";
import { join } from "node:path";
import { access, readFile, copyFile } from "node:fs/promises";
import { constants, mkdirSync, appendFileSync } from "node:fs";
import { spawn } from "node:child_process";
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
const MODEL_INSTALL_TIMEOUT = 30 * 60 * 1e3;
const SHUTDOWN_TIMEOUT = 3e3;
class EngineManager extends EventEmitter {
  constructor(logger2) {
    super();
    this.logger = logger2;
    this.child = null;
    this.pending = /* @__PURE__ */ new Map();
    this.sequence = 0;
    this.status = "stopped";
    this.buffer = "";
    this.stopping = false;
  }
  async start() {
    var _a, _b, _c, _d, _e;
    if (this.child) {
      return this.status;
    }
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
    this.child = spawn(paths.command, args, {
      cwd: paths.cwd,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true
    });
    (_c = this.logger) == null ? void 0 : _c.info("engine", `sidecar started pid=${this.child.pid}`);
    this.child.stdout.setEncoding("utf8");
    this.child.stderr.setEncoding("utf8");
    this.child.stdout.on("data", (chunk) => this.handleStdout(chunk));
    this.child.stderr.on("data", (chunk) => this.emit("stderr", chunk));
    this.child.once("error", (error) => {
      this.emit(
        "stderr",
        `Failed to start engine (${paths.command}, cwd: ${paths.cwd}): ${error.message}
`
      );
      this.handleExit(error);
    });
    this.child.once("exit", (code, signal) => {
      this.handleExit(
        new Error(
          `Engine exited with code ${code ?? "unknown"}${signal ? ` (${signal})` : ""}`
        )
      );
    });
    try {
      await this.request("engine.hello");
      await this.request("engine.health");
      this.status = "ready";
      (_d = this.logger) == null ? void 0 : _d.info("engine", "engine ready");
      this.emit("status", this.status);
      return this.status;
    } catch (error) {
      this.stopChild();
      this.status = "unavailable";
      (_e = this.logger) == null ? void 0 : _e.error("engine", `startup failed: ${error.message}`);
      this.emit("status", this.status, error);
      throw error;
    }
  }
  request(method, params = {}, timeout = REQUEST_TIMEOUT) {
    var _a, _b, _c;
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
        (_a2 = this.logger) == null ? void 0 : _a2.error("engine", `request ${method} timed out after ${timeout}ms`);
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
  async stop() {
    if (!this.child) {
      this.status = "stopped";
      return;
    }
    this.stopping = true;
    try {
      await this.request("engine.shutdown", {}, SHUTDOWN_TIMEOUT);
    } catch {
      this.stopChild();
    }
    this.stopChild();
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
  handleExit(error) {
    var _a;
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
      this.status = "unavailable";
      (_a = this.logger) == null ? void 0 : _a.error("engine", `sidecar exited: ${error.message}`);
      this.emit("status", this.status, error);
    }
  }
  stopChild() {
    if (this.child && !this.child.killed) {
      this.child.kill();
    }
    this.child = null;
  }
}
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
function timestamp(date = /* @__PURE__ */ new Date()) {
  const pad = (value, size = 2) => String(value).padStart(size, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
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
function registerGreetHandler() {
  ipcMain.handle("greet", (_, name) => `你好，${name}！`);
}
function getManager(event, manager) {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || window.isDestroyed()) {
    throw new Error("Invalid renderer window");
  }
  return manager;
}
function requireString(value, name) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} must be a non-empty string`);
  }
  return value;
}
function requireObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
  return value;
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
  ipcMain.handle("artifacts:get", (event, artifactId) => {
    getManager(event, manager);
    return manager.request("artifacts.get", {
      artifactId: requireString(artifactId, "artifactId")
    });
  });
  ipcMain.handle("artifacts:delete", (event, artifactId) => {
    getManager(event, manager);
    return manager.request("artifacts.delete", {
      artifactId: requireString(artifactId, "artifactId")
    });
  });
}
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function validateSender(event) {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || window.isDestroyed()) {
    throw new Error("Invalid renderer window");
  }
}
function requireArtifactId(artifactId) {
  if (typeof artifactId !== "string" || !UUID_PATTERN.test(artifactId)) {
    throw new Error("artifactId must be a valid UUID");
  }
  return artifactId.toLowerCase();
}
function getArtifactPath(artifactId) {
  return join(getEnginePaths().appData, "outputs", `${artifactId}.wav`);
}
async function requireArtifactFile(artifactId) {
  const path = getArtifactPath(artifactId);
  try {
    await access(path, constants.R_OK);
  } catch {
    throw new Error("Artifact not found");
  }
  return path;
}
function registerArtifactHandlers() {
  ipcMain.handle("artifacts:read", async (event, artifactId) => {
    validateSender(event);
    const path = await requireArtifactFile(requireArtifactId(artifactId));
    return readFile(path);
  });
  ipcMain.handle("artifacts:download", async (event, artifactId) => {
    validateSender(event);
    const normalizedArtifactId = requireArtifactId(artifactId);
    const source = await requireArtifactFile(normalizedArtifactId);
    const fileName = `qwen3-tts-${normalizedArtifactId}.wav`;
    const target = join(app.getPath("downloads"), fileName);
    await copyFile(source, target);
    return { fileName };
  });
}
const EVENTS = /* @__PURE__ */ new Set([
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
  "artifact_downloaded"
]);
const ROUTES = /* @__PURE__ */ new Set(["home", "voice_generate", "voice_clone", "settings"]);
const COMPONENTS = /* @__PURE__ */ new Set([
  "engine_bootstrap",
  "sidebar",
  "title_bar",
  "home_page",
  "voice_generate_page",
  "voice_clone_page",
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
  if (event === "page_view" && !ROUTES.has(result.route)) {
    throw new Error("invalid telemetry route");
  }
  if (event === "component_used" && !COMPONENTS.has(result.component)) {
    throw new Error("invalid telemetry component");
  }
  return result;
}
function registerTelemetryHandler(logger2) {
  ipcMain.handle("telemetry:track", (event, name, properties) => {
    if (typeof name !== "string" || !EVENTS.has(name)) {
      throw new Error("invalid telemetry event");
    }
    const safeProperties = validateProperties(name, properties);
    logger2.info("telemetry", `${name} ${JSON.stringify(safeProperties)}`);
    return { tracked: true };
  });
}
function getWindow(event) {
  return BrowserWindow.fromWebContents(event.sender);
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
const logger = createLogger(getEnginePaths().appData);
const engine = new EngineManager(logger);
let mainWindow;
let quitting = false;
function createWindow() {
  mainWindow = new BrowserWindow({
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
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(join(import.meta.dirname, "../../dist/index.html"));
  }
}
app.whenReady().then(async () => {
  logger.info("app", "application ready");
  registerGreetHandler();
  registerEngineHandlers(engine);
  registerArtifactHandlers();
  registerWindowControlHandlers();
  registerTelemetryHandler(logger);
  engine.on(
    "status",
    (status) => mainWindow == null ? void 0 : mainWindow.webContents.send("engine:status-changed", status)
  );
  engine.on("event", (message) => {
    logger.debug("engine", `event ${message.event}`);
    const channel = {
      "job.updated": "engine:job-updated",
      "artifact.created": "engine:artifact-created"
    }[message.event];
    if (channel) {
      mainWindow == null ? void 0 : mainWindow.webContents.send(channel, message.payload);
    }
  });
  engine.on("stderr", (message) => {
    for (const line of message.split(/\r?\n/)) {
      if (line.trim()) logger.warn("python", line.trim());
    }
  });
  createWindow();
  try {
    await engine.start();
  } catch (error) {
    logger.error("app", `engine startup failed: ${error.message}`);
  }
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
app.on("before-quit", async (event) => {
  if (quitting) {
    return;
  }
  event.preventDefault();
  quitting = true;
  logger.info("app", "application quitting");
  await engine.stop();
  app.quit();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
