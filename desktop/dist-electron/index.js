import { app as f, BrowserWindow as z, ipcMain as l } from "electron";
import { constants as I, mkdirSync as T, appendFileSync as B } from "node:fs";
import { join as h, basename as Z } from "node:path";
import { access as A, writeFile as ee, readFile as M, unlink as F, mkdir as V, copyFile as te, readdir as re, stat as j } from "node:fs/promises";
import { spawn as ne, execFile as ie } from "node:child_process";
import { EventEmitter as se } from "node:events";
const D = h(f.getAppPath(), "..");
function N() {
  return f.isPackaged ? {
    command: h(process.resourcesPath, "engine", "qwen-tts-engine.exe"),
    args: [],
    cwd: process.resourcesPath,
    appData: f.getPath("userData"),
    cache: f.getPath("cache"),
    packaged: !0
  } : {
    command: h(D, ".venv", "Scripts", "python.exe"),
    args: ["-m", "qwen_tts_engine", "--device", "cpu", "--dtype", "float32"],
    cwd: h(D, "core"),
    appData: h(D, ".local", "app-data"),
    cache: h(D, ".local", "cache"),
    packaged: !1
  };
}
const C = 1;
function oe(t, e, r = {}) {
  return {
    protocolVersion: C,
    type: "request",
    requestId: t,
    method: e,
    params: r
  };
}
function ae(t) {
  const e = JSON.parse(t);
  if (e.protocolVersion !== C || typeof e.type != "string")
    throw new Error("Invalid engine protocol message");
  if (e.type === "response" && typeof e.requestId != "string")
    throw new Error("Invalid engine response");
  if (e.type === "event" && typeof e.event != "string")
    throw new Error("Invalid engine event");
  return e;
}
const L = 3e4, U = 12e4, ce = 30 * 60 * 1e3, de = 6e3, P = 2e3, W = 15e3;
class ue extends se {
  constructor(e) {
    super(), this.logger = e, this.child = null, this.pending = /* @__PURE__ */ new Map(), this.sequence = 0, this.status = "stopped", this.buffer = "", this.stopping = !1, this.ready = !1, this.stopRequested = !1, this.startPromise = null, this.stopPromise = null;
  }
  async start() {
    if (this.stopping || this.stopRequested)
      throw new Error("Engine is stopping");
    if (this.child)
      return this.status;
    if (this.startPromise)
      return this.startPromise;
    this.startPromise = this.startEngine();
    try {
      return await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }
  async startEngine() {
    var i, s, a, o, d;
    const e = N();
    if ((i = this.logger) == null || i.info("engine", `starting engine (${e.packaged ? "packaged" : "development"})`), !e.packaged)
      try {
        await A(e.command, I.X_OK);
      } catch {
        const c = new Error(
          `Python engine environment is missing: ${e.command}. From the repository root, run: python -m venv .venv && .venv/Scripts/python.exe -m pip install -e core`
        );
        throw (s = this.logger) == null || s.error("engine", c.message), this.emit("status", this.status, c), this.emit("stderr", `${c.message}
`), c;
      }
    const r = [
      ...e.args,
      "--app-data-dir",
      e.appData,
      "--cache-dir",
      e.cache
    ];
    if (this.status = "starting", this.emit("status", this.status), this.stopRequested)
      throw new Error("Engine shutdown requested");
    const n = ne(e.command, r, {
      cwd: e.cwd,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: !0
    });
    this.child = n, (a = this.logger) == null || a.info("engine", `sidecar started pid=${n.pid}`), n.stdout.setEncoding("utf8"), n.stderr.setEncoding("utf8"), n.stdout.on("data", (c) => this.handleStdout(c)), n.stderr.on("data", (c) => {
      this.stopRequested || this.emit("stderr", c);
    }), n.once("error", (c) => {
      this.stopRequested || this.emit(
        "stderr",
        `Failed to start engine (${e.command}, cwd: ${e.cwd}): ${c.message}
`
      ), this.handleExit(n, c);
    }), n.once("exit", (c, u) => {
      this.handleExit(
        n,
        new Error(
          `Engine exited with code ${c ?? "unknown"}${u ? ` (${u})` : ""}`
        )
      );
    });
    try {
      if (await this.request("engine.hello", {}, U), await this.request("engine.health", {}, U), this.stopRequested)
        throw new Error("Engine shutdown requested");
      return this.ready = !0, this.status = "ready", (o = this.logger) == null || o.info("engine", "engine ready"), this.emit("status", this.status), this.status;
    } catch (c) {
      throw this.stopRequested || (await this.forceStop(n), await this.waitForExit(n, W) || (await this.forceStop(n, !0), await this.waitForExit(n, P)), this.status = "unavailable", (d = this.logger) == null || d.error("engine", `startup failed: ${c.message}`), this.emit("status", this.status, c)), c;
    }
  }
  request(e, r = {}, n = L) {
    var o, d, c;
    if ((this.stopping || this.stopRequested) && e !== "engine.shutdown")
      return Promise.reject(new Error("Engine is stopping"));
    if (!((d = (o = this.child) == null ? void 0 : o.stdin) != null && d.writable))
      return Promise.reject(new Error("Engine is not running"));
    e === "models.install" && n === L && (n = ce);
    const i = `req-${++this.sequence}`, s = `${JSON.stringify(oe(i, e, r))}
`, a = Date.now();
    return (c = this.logger) == null || c.debug("engine", `request ${e} started`), new Promise((u, p) => {
      const w = setTimeout(() => {
        var $;
        this.pending.delete(i);
        const E = e === "engine.hello" || e === "engine.health" ? "startup handshake" : "request";
        ($ = this.logger) == null || $.error(
          "engine",
          `${E} ${e} timed out after ${n}ms`
        ), p(new Error(`Engine request timed out: ${e}`));
      }, n);
      this.pending.set(i, {
        resolve: u,
        reject: p,
        timer: w,
        method: e,
        startedAt: a
      }), this.child.stdin.write(s, "utf8", (E) => {
        var $;
        E && (clearTimeout(w), this.pending.delete(i), ($ = this.logger) == null || $.error("engine", `request ${e} write failed: ${E.message}`), p(E));
      });
    });
  }
  stop() {
    return this.stopRequested = !0, this.stopPromise || (this.stopPromise = this.stopEngine()), this.stopPromise;
  }
  async stopEngine() {
    var i, s, a;
    const e = this.child;
    if (!e) {
      this.ready = !1, this.status = "stopped";
      return;
    }
    this.stopping = !0;
    const r = this.ready;
    if (!r)
      this.closeStdin(e);
    else
      try {
        await this.request("engine.shutdown", {}, de);
      } catch (o) {
        this.child === e && ((i = this.logger) == null || i.warn("engine", `graceful shutdown failed: ${o.message}`));
      }
    const n = r ? P : W;
    await this.waitForExit(e, n) || ((s = this.logger) == null || s.warn("engine", `sidecar did not exit gracefully pid=${e.pid}`), await this.forceStop(e), await this.waitForExit(e, P) || (await this.forceStop(e, !0), await this.waitForExit(e, P) || (a = this.logger) == null || a.error("engine", `sidecar did not exit after forced stop pid=${e.pid}`))), this.status = "stopped", this.emit("status", this.status);
  }
  handleStdout(e) {
    var n, i, s, a, o, d;
    this.buffer += e;
    const r = this.buffer.split(/\r?\n/);
    this.buffer = r.pop();
    for (const c of r)
      if (c.trim())
        try {
          const u = ae(c);
          if (u.type === "event") {
            this.emit("event", u);
            continue;
          }
          const p = this.pending.get(u.requestId);
          if (!p)
            continue;
          if (this.pending.delete(u.requestId), clearTimeout(p.timer), u.ok)
            (n = this.logger) == null || n.debug(
              "engine",
              `request ${p.method} succeeded in ${Date.now() - p.startedAt}ms`
            ), p.resolve(u.result);
          else {
            const w = new Error(
              ((i = u.error) == null ? void 0 : i.message) || "Engine request failed"
            );
            w.code = (s = u.error) == null ? void 0 : s.code, w.details = (a = u.error) == null ? void 0 : a.details, (o = this.logger) == null || o.error(
              "engine",
              `request ${p.method} failed (${w.code || "unknown"}) in ${Date.now() - p.startedAt}ms`
            ), p.reject(w);
          }
        } catch (u) {
          (d = this.logger) == null || d.error("engine", `protocol parse failed: ${u.message}`), this.emit("stderr", `${u.message}
`);
        }
  }
  handleExit(e, r) {
    var n;
    if (this.child === e) {
      this.child = null, this.ready = !1;
      for (const i of this.pending.values())
        clearTimeout(i.timer), i.reject(r);
      this.pending.clear(), this.stopping || (this.status = "unavailable", (n = this.logger) == null || n.error("engine", `sidecar exited: ${r.message}`), this.emit("status", this.status, r));
    }
  }
  closeStdin(e) {
    e.stdin && !e.stdin.destroyed && !e.stdin.writableEnded && e.stdin.end();
  }
  waitForExit(e, r) {
    return this.child !== e ? Promise.resolve(!0) : new Promise((n) => {
      const i = setTimeout(() => {
        e.removeListener("exit", s), n(this.child !== e);
      }, r), s = () => {
        clearTimeout(i), n(!0);
      };
      e.once("exit", s);
    });
  }
  async forceStop(e, r = !1) {
    if (!(this.child !== e || !e.pid)) {
      if (process.platform === "win32") {
        await new Promise((n) => {
          ie(
            "taskkill",
            ["/PID", String(e.pid), "/T", "/F"],
            { windowsHide: !0 },
            (i) => {
              var s;
              i && ((s = this.logger) == null || s.warn("engine", `taskkill failed: ${i.message}`)), n();
            }
          );
        });
        return;
      }
      e.killed || e.kill(r ? "SIGKILL" : "SIGTERM");
    }
  }
}
function le(t, e, r) {
  function n(i, s) {
    const a = r();
    if (!(!a || a.isDestroyed() || a.webContents.isDestroyed()))
      try {
        a.webContents.send(i, s);
      } catch {
      }
  }
  t.on("status", (i) => {
    n("engine:status-changed", i);
  }), t.on("event", (i) => {
    e.debug("engine", `event ${i.event}`);
    const s = {
      "job.updated": "engine:job-updated",
      "artifact.created": "engine:artifact-created"
    }[i.event];
    s && (i.event === "artifact.created" && e.info("artifact", "artifact created received; forwarding to renderer"), n(s, i.payload), i.event === "artifact.created" && e.info("artifact", "artifact forwarded to renderer for preview"));
  }), t.on("stderr", (i) => {
    for (const s of i.split(/\r?\n/))
      s.trim() && e.warn("python", s.trim());
  });
}
function v(t) {
  return z.fromWebContents(t.sender);
}
function m(t) {
  const e = v(t);
  if (!e || e.isDestroyed())
    throw new Error("Invalid renderer window");
  return e;
}
function g(t, e) {
  return m(t), e;
}
function S(t, e) {
  if (typeof t != "string" || !t.trim())
    throw new Error(`${e} must be a non-empty string`);
  return t.trim();
}
function q(t) {
  const e = S(t, "artifactId");
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(e))
    throw new Error("artifactId must be a UUID");
  return e;
}
function O(t, e) {
  if (!t || typeof t != "object" || Array.isArray(t))
    throw new Error(`${e} must be an object`);
  return t;
}
function J() {
  return {
    modelDownloadProxy: "http://127.0.0.1:7897",
    audioDownloadDir: h(f.getPath("music"), "qwen3-tts-downloads")
  };
}
function Y() {
  return h(f.getPath("userData"), "config.json");
}
async function G() {
  try {
    const t = await M(Y(), "utf8");
    return K(JSON.parse(t));
  } catch {
    return J();
  }
}
function K(t) {
  const e = J(), r = t && typeof t == "object" ? t : {}, n = typeof r.modelDownloadProxy == "string" ? r.modelDownloadProxy.trim() : e.modelDownloadProxy, i = typeof r.audioDownloadDir == "string" && r.audioDownloadDir.trim() ? r.audioDownloadDir.trim() : e.audioDownloadDir;
  return {
    modelDownloadProxy: n,
    audioDownloadDir: i
  };
}
function fe() {
  l.handle("settings:get", async (t) => (m(t), G())), l.handle("settings:save", async (t, e) => {
    m(t);
    const r = K(O(e, "settings"));
    return await ee(
      Y(),
      `${JSON.stringify(r, null, 2)}
`,
      "utf8"
    ), r;
  });
}
function b(t) {
  return String(t).padStart(2, "0");
}
function he(t = /* @__PURE__ */ new Date()) {
  return `${t.getFullYear()}-${b(t.getMonth() + 1)}-${b(
    t.getDate()
  )}-${b(t.getHours())}-${b(t.getMinutes())}-${b(t.getSeconds())}.wav`;
}
function x() {
  return h(N().appData, "outputs");
}
function Q(t) {
  return h(x(), `${t}.json`);
}
function y(t) {
  return h(x(), t);
}
async function pe(t) {
  try {
    return JSON.parse(await M(t, "utf8"));
  } catch {
    return null;
  }
}
async function k(t, e, r, n) {
  return {
    artifactId: t,
    fileName: e,
    mimeType: typeof (r == null ? void 0 : r.mimeType) == "string" ? r.mimeType : "audio/wav",
    sampleRate: typeof (r == null ? void 0 : r.sampleRate) == "number" ? r.sampleRate : void 0,
    createdAt: typeof (r == null ? void 0 : r.createdAt) == "number" ? r.createdAt : n.mtimeMs
  };
}
async function _(t) {
  const e = Q(t), r = await pe(e);
  if (r) {
    const s = typeof r.fileName == "string" && r.fileName.trim() ? r.fileName.trim() : `${t}.wav`;
    if (Z(s) !== s || !s.endsWith(".wav"))
      return null;
    const a = s, o = y(a);
    try {
      return await A(o, I.R_OK), k(
        typeof r.artifactId == "string" && r.artifactId.trim() ? r.artifactId.trim() : t,
        a,
        r,
        await j(o)
      );
    } catch {
      return null;
    }
  }
  const n = `${t}.wav`, i = y(n);
  try {
    return await A(i, I.R_OK), k(
      t,
      n,
      null,
      await j(i)
    );
  } catch {
    return null;
  }
}
async function ge() {
  await V(x(), { recursive: !0 });
  const t = await re(x(), { withFileTypes: !0 }), e = [], r = /* @__PURE__ */ new Set();
  for (const n of t) {
    if (!n.isFile() || !n.name.endsWith(".json") || n.name.endsWith(".tmp.json"))
      continue;
    const i = n.name.replace(/\.json$/i, "");
    if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(i))
      continue;
    const s = await _(i);
    s && (e.push(s), r.add(s.fileName));
  }
  for (const n of t) {
    if (!n.isFile() || !n.name.endsWith(".wav") || n.name.endsWith(".tmp.wav") || r.has(n.name))
      continue;
    const i = y(n.name), s = await j(i);
    e.push(
      await k(
        n.name.replace(/\.wav$/i, ""),
        n.name,
        null,
        s
      )
    );
  }
  return e.sort((n, i) => (i.createdAt || 0) - (n.createdAt || 0)), e;
}
function we(t) {
  l.handle("artifacts:list", async (e) => (m(e), { artifacts: await ge() })), l.handle("artifacts:get", async (e, r) => {
    g(e, t);
    const n = await _(q(r));
    if (!n)
      throw new Error("Artifact not found");
    return n;
  }), l.handle("artifacts:delete", async (e, r) => {
    g(e, t);
    const n = q(r), i = await _(n);
    if (!i)
      throw new Error("Artifact not found");
    return await Promise.all([
      F(y(i.fileName)).catch(() => {
      }),
      F(Q(n)).catch(() => {
      })
    ]), { deleted: !0 };
  }), l.handle("artifacts:read", async (e, r) => {
    m(e);
    const n = await _(q(r));
    if (!n)
      throw new Error("Artifact not found");
    return M(y(n.fileName));
  }), l.handle("artifacts:download", async (e, r) => {
    m(e);
    const n = q(r), i = await _(n);
    if (!i)
      throw new Error("Artifact not found");
    const a = (await G()).audioDownloadDir, o = he(), d = h(a, o);
    return await V(a, { recursive: !0 }), await te(y(i.fileName), d), { fileName: o, target: d };
  });
}
function me(t) {
  if (t == null || t === "") return;
  if (typeof t != "string")
    throw new Error("proxy must be a string");
  let e;
  try {
    e = new URL(t);
  } catch {
    throw new Error("proxy must be a valid URL");
  }
  if (!["http:", "https:"].includes(e.protocol) || !e.hostname || !e.port)
    throw new Error("proxy must use http://host:port or https://host:port");
  return t;
}
function ye(t) {
  l.handle("engine:status", (e) => (g(e, t), t.status)), l.handle("models:list", (e) => (g(e, t), t.request("models.list"))), l.handle("models:capabilities", (e, r) => (g(e, t), t.request("models.capabilities", {
    modelId: S(r, "modelId")
  }))), l.handle("models:install", (e, r) => {
    g(e, t);
    const n = O(r, "params");
    return t.request("models.install", {
      modelId: S(n.modelId, "modelId"),
      proxy: me(n.proxy)
    });
  }), l.handle("jobs:submit", (e, r) => (g(e, t), t.request("jobs.submit", O(r, "params")))), l.handle("jobs:get", (e, r) => (g(e, t), t.request("jobs.get", {
    jobId: S(r, "jobId")
  }))), l.handle("jobs:cancel", (e, r) => (g(e, t), t.request("jobs.cancel", {
    jobId: S(r, "jobId")
  })));
}
function Ee() {
  l.handle("greet", (t, e) => `你好，${e}！`);
}
const $e = /* @__PURE__ */ new Set([
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
]), be = /* @__PURE__ */ new Set([
  "home",
  "voice_generate",
  "voice_clone",
  "audio_files",
  "settings"
]), ve = /* @__PURE__ */ new Set([
  "engine_bootstrap",
  "sidebar",
  "title_bar",
  "home_page",
  "voice_generate_page",
  "voice_clone_page",
  "audio_files_page",
  "settings_page"
]);
function Se(t, e = {}) {
  if (!e || typeof e != "object" || Array.isArray(e))
    throw new Error("telemetry properties must be an object");
  const r = {};
  for (const [n, i] of Object.entries(e)) {
    if (typeof n != "string" || n.length > 32 || typeof i != "string" && typeof i != "number" && typeof i != "boolean" || typeof i == "string" && i.length > 80)
      throw new Error("invalid telemetry property");
    r[n] = i;
  }
  if (t === "page_view" && !be.has(r.route))
    throw new Error("invalid telemetry route");
  if (t === "component_used" && !ve.has(r.component))
    throw new Error("invalid telemetry component");
  return r;
}
function _e(t) {
  l.handle("telemetry:track", (e, r, n) => {
    if (typeof r != "string" || !$e.has(r))
      throw new Error("invalid telemetry event");
    const i = Se(r, n);
    return t.info("telemetry", `${r} ${JSON.stringify(i)}`), { tracked: !0 };
  });
}
function De() {
  l.handle("window:minimize", (t) => {
    var e;
    (e = v(t)) == null || e.minimize();
  }), l.handle("window:toggle-maximize", (t) => {
    const e = v(t);
    return e ? e.isMaximized() ? (e.unmaximize(), !1) : (e.maximize(), !0) : !1;
  }), l.handle("window:close", (t) => {
    var e;
    (e = v(t)) == null || e.close();
  }), l.handle("window:is-maximized", (t) => {
    var e;
    return ((e = v(t)) == null ? void 0 : e.isMaximized()) ?? !1;
  });
}
function Pe(t, e) {
  Ee(), ye(t), we(t), fe(), De(), _e(e);
}
const R = { debug: 10, info: 20, warn: 30, error: 40 };
function X(t = /* @__PURE__ */ new Date()) {
  const e = (r, n = 2) => String(r).padStart(n, "0");
  return `${t.getFullYear()}-${e(t.getMonth() + 1)}-${e(t.getDate())}-${e(t.getHours())}-${e(t.getMinutes())}-${e(t.getSeconds())}`;
}
function qe(t = /* @__PURE__ */ new Date()) {
  return `${X(t)}.${String(t.getMilliseconds()).padStart(3, "0")}`;
}
function Te(t, e = process.env.QWEN_TTS_LOG_LEVEL || "info") {
  const r = R[e] || R.info, n = h(t, "logs"), i = h(n, `${X()}.log`);
  let s = !1;
  try {
    T(n, { recursive: !0 }), s = !0;
  } catch (o) {
    console.error(`[logger] unable to create log directory: ${o.message}`);
  }
  function a(o, d, c) {
    if (R[o] < r) return;
    const u = `${qe()} [${o.toUpperCase()}] [${d}] ${c}`;
    if (o === "error" ? console.error(u) : o === "warn" ? console.warn(u) : console.log(u), s)
      try {
        B(i, `${u}
`, "utf8");
      } catch (p) {
        s = !1, console.error(`[logger] unable to write log file: ${p.message}`);
      }
  }
  return {
    filePath: i,
    debug: (o, d) => a("debug", o, d),
    info: (o, d) => a("info", o, d),
    warn: (o, d) => a("warn", o, d),
    error: (o, d) => a("error", o, d)
  };
}
function H() {
  const t = new z({
    title: "Qwen3 TTS Desktop",
    width: 1024,
    height: 768,
    minWidth: 800,
    minHeight: 600,
    frame: !1,
    show: !1,
    webPreferences: {
      preload: h(import.meta.dirname, "index.mjs"),
      nodeIntegration: !1,
      contextIsolation: !0,
      sandbox: !0,
      webSecurity: !0
    }
  });
  return t.once("ready-to-show", () => t.show()), t.webContents.on("did-fail-load", (r, n, i) => {
    console.error(
      `Renderer failed to load (${n}): ${i}`
    );
  }), (process.env.VITE_DEV_SERVER_URL ? t.loadURL(process.env.VITE_DEV_SERVER_URL) : t.loadFile(h(import.meta.dirname, "../../dist/index.html"))).catch((r) => {
    console.error(`Renderer failed to load: ${r.message}`);
  }), t;
}
if (!f.requestSingleInstanceLock())
  f.quit();
else {
  const t = N(), e = h(t.appData, "session-data");
  T(t.appData, { recursive: !0 }), T(t.cache, { recursive: !0 }), T(e, { recursive: !0 }), f.setPath("userData", t.appData), f.setPath("cache", t.cache), f.setPath("sessionData", e);
  const r = Te(t.appData), n = new ue(r);
  let i, s, a = !1, o = !1;
  f.on("second-instance", () => {
    !i || i.isDestroyed() || (i.isMinimized() && i.restore(), i.show(), i.focus());
  }), f.whenReady().then(() => {
    a || (r.info("app", "application ready"), Pe(n, r), le(n, r, () => i), i = H(), n.start().catch((d) => {
      a || r.error("app", `engine startup failed: ${d.message}`);
    }), f.on("activate", () => {
      (!i || i.isDestroyed()) && (i = H());
    }));
  }), f.on("before-quit", (d) => {
    a = !0, !o && (d.preventDefault(), !s && (r.info("app", "application quitting"), s = n.stop().catch((c) => {
      r.error("app", `engine shutdown failed: ${c.message}`);
    }), s.finally(() => {
      o = !0, f.quit();
    })));
  }), f.on("window-all-closed", () => {
    process.platform !== "darwin" && f.quit();
  });
}
