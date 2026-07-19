import { contextBridge, ipcRenderer } from "electron";

const invoke = <T>(channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args) as Promise<T>;

contextBridge.exposeInMainWorld("companion", {
  getState: () => invoke("companion:get-state"), moveBy: (delta: { x: number; y: number }) => invoke("companion:move-by", delta), resize: (delta: number) => invoke("companion:resize", delta),
  setHoverOpacity: (opacity: number) => invoke("companion:set-hover-opacity", opacity), toggleLock: () => invoke("companion:toggle-lock"), remove: () => invoke("companion:remove"),
  chooseLocalAsset: () => invoke("companion:choose-local-asset"), setAssetUrl: (url: string) => invoke("companion:set-asset-url", url), clearLocalAsset: () => invoke("companion:clear-local-asset"),
  bringToFront: () => invoke("companion:bring-to-front"), reportAssetError: () => invoke("companion:report-asset-error"),
  reportAspectRatio: (dimensions: { width: number; height: number }) => invoke("companion:report-aspect-ratio", dimensions),
  expandForMenu: (size: { width: number; height: number }) => invoke("companion:expand-for-menu", size),
  restoreSize: () => invoke("companion:restore-size"),
  onState: (callback: (state: unknown) => void) => { const listener = (_event: Electron.IpcRendererEvent, state: unknown) => callback(state); ipcRenderer.on("companion:state", listener); return () => ipcRenderer.removeListener("companion:state", listener); }
});

contextBridge.exposeInMainWorld("desktopApp", {
  getSettings: () => invoke("app:get-settings"), updateSettings: (updates: unknown) => invoke("app:update-settings", updates), addCompanion: () => invoke("app:add-companion"), listProfiles: () => invoke("app:list-profiles"), saveProfile: (name: string) => invoke("app:save-profile", name), loadProfile: (name: string) => invoke("app:load-profile", name), deleteProfile: (name: string) => invoke("app:delete-profile", name)
});
