import { contextBridge, ipcRenderer } from "electron";
import type { SettingsApi } from "../src/types/ipc-contracts";

/**
 * The only bridge between the renderer and the main process. Exposes
 * exactly the named functions below — never a generic invoke(channel,
 * ...args) passthrough — so the renderer can never call an arbitrary
 * IPC channel, only these two.
 */
const settingsApi: SettingsApi = {
  get: (key) => ipcRenderer.invoke("settings:get", key),
  set: (key, value) => ipcRenderer.invoke("settings:set", { key, value }),
};

contextBridge.exposeInMainWorld("api", {
  settings: settingsApi,
});
