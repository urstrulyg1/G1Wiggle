/**
 * G1Wiggle — Desktop Electron Preload Script
 */

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  platform: process.platform,
  arch: process.arch,
  setPowerSave: (active) => ipcRenderer.send("wiggle:power-save", { active }),
  minimize: () => ipcRenderer.send("wiggle:window-minimize"),
  maximize: () => ipcRenderer.send("wiggle:window-maximize"),
  close: () => ipcRenderer.send("wiggle:window-close"),
  getAppVersion: () => "1.0.0",
});
