import { ipcMain, BrowserWindow, app } from "electron";
import { join } from "node:path";
function registerGreetHandler() {
  ipcMain.handle("greet", (_, name) => `你好，${name}！`);
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
function createWindow() {
  const window = new BrowserWindow({
    title: "Qwen3 TTS Desktop",
    width: 1024,
    height: 768,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    webPreferences: {
      preload: join(import.meta.dirname, "index.mjs")
    }
  });
  if (process.env.VITE_DEV_SERVER_URL) {
    window.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    window.loadFile(join(import.meta.dirname, "../../dist/index.html"));
  }
}
app.whenReady().then(() => {
  registerGreetHandler();
  registerWindowControlHandlers();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
