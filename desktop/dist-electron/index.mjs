"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("api", {
  greet: (name) => electron.ipcRenderer.invoke("greet", name),
  minimizeWindow: () => electron.ipcRenderer.invoke("window:minimize"),
  toggleMaximizeWindow: () => electron.ipcRenderer.invoke("window:toggle-maximize"),
  closeWindow: () => electron.ipcRenderer.invoke("window:close"),
  isWindowMaximized: () => electron.ipcRenderer.invoke("window:is-maximized")
});
