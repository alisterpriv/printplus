import { contextBridge, ipcRenderer } from "electron";
import type { SettingsApi, RatesApi, CustomersApi, OrdersApi, DashboardApi } from "../src/types/ipc-contracts";

/**
 * The only bridge between the renderer and the main process. Exposes
 * exactly the named functions below — never a generic invoke(channel,
 * ...args) passthrough — so the renderer can never call an arbitrary
 * IPC channel, only these.
 */
const settingsApi: SettingsApi = {
  get: (key) => ipcRenderer.invoke("settings:get", key),
  set: (key, value) => ipcRenderer.invoke("settings:set", { key, value }),
};

const ratesApi: RatesApi = {
  list: () => ipcRenderer.invoke("rates:list"),
  update: (id, rate) => ipcRenderer.invoke("rates:update", { id, rate }),
};

const customersApi: CustomersApi = {
  list: () => ipcRenderer.invoke("customers:list"),
  create: (input) => ipcRenderer.invoke("customers:create", input),
  update: (id, input) => ipcRenderer.invoke("customers:update", { id, ...input }),
};

const ordersApi: OrdersApi = {
  list: () => ipcRenderer.invoke("orders:list"),
  get: (id) => ipcRenderer.invoke("orders:get", id),
  create: (input) => ipcRenderer.invoke("orders:create", input),
  updateStatus: (id, status) => ipcRenderer.invoke("orders:updateStatus", { id, status }),
};

const dashboardApi: DashboardApi = {
  getSummary: () => ipcRenderer.invoke("dashboard:getSummary"),
};

contextBridge.exposeInMainWorld("api", {
  settings: settingsApi,
  rates: ratesApi,
  customers: customersApi,
  orders: ordersApi,
  dashboard: dashboardApi,
});
