import { app, BrowserWindow, dialog, globalShortcut, ipcMain, Menu, nativeImage, screen, Tray } from "electron";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Companion, CompanionManager, CompanionSettings } from "./companion-manager";

type PointDelta = { x: number; y: number };
type CompanionView = Companion & { assetUrl: string; settings: CompanionSettings };

const MAX_LOCAL_ASSET_BYTES = 25 * 1024 * 1024;
const MAX_REMOTE_ASSET_BYTES = 15 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg", ".webm"]);

let manager: CompanionManager;
const companionWindows = new Map<string, BrowserWindow>();
let tray: Tray | undefined;
let settingsWindow: BrowserWindow | undefined;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function senderCompanion(event: Electron.IpcMainInvokeEvent): [string, BrowserWindow] | undefined {
  for (const [id, window] of companionWindows) {
    if (!window.isDestroyed() && window.webContents.id === event.sender.id) return [id, window];
  }
  return undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The requested action could not be completed.";
}

function validateLocalAsset(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) throw new Error("Choose a PNG, JPEG, GIF, WebP, BMP, SVG, or WebM file.");
  const stat = statSync(filePath);
  if (!stat.isFile() || stat.size > MAX_LOCAL_ASSET_BYTES) throw new Error("The selected asset is not a supported file or is larger than 25 MB.");
  return filePath;
}

function validateRemoteUrl(value: string): URL {
  if (value.length > 2_048) throw new Error("The asset URL is too long.");
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Enter a valid http or https URL."); }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Only http and https asset URLs are allowed.");
  return url;
}

function displayFor(window: BrowserWindow) {
  return screen.getDisplayMatching(window.getBounds());
}

function boundsFor(companion: Companion, display = screen.getPrimaryDisplay()) {
  const { x, y, width, height } = display.workArea;
  const size = companion.size;
  return {
    x: Math.round(x + companion.x * Math.max(0, width - size)),
    y: Math.round(y + companion.y * Math.max(0, height - size)),
    width: size,
    height: size
  };
}

function normalizedPosition(bounds: Electron.Rectangle, size: number, display: Electron.Display): Pick<Companion, "x" | "y"> {
  const area = display.workArea;
  return {
    x: Math.max(0, Math.min(1, (bounds.x - area.x) / Math.max(1, area.width - size))),
    y: Math.max(0, Math.min(1, (bounds.y - area.y) / Math.max(1, area.height - size)))
  };
}

function bundledAssetUrl(): string {
  return pathToFileURL(path.join(__dirname, "assets", "default.svg")).toString();
}

async function cacheRemoteAsset(rawUrl: string): Promise<string> {
  const url = validateRemoteUrl(rawUrl);
  const cacheDirectory = path.join(app.getPath("userData"), "asset-cache");
  mkdirSync(cacheDirectory, { recursive: true });
  const hash = createHash("sha256").update(url.toString()).digest("hex");
  const existing = [...ALLOWED_EXTENSIONS].map((extension) => path.join(cacheDirectory, `${hash}${extension}`)).find(existsSync);
  if (existing) return pathToFileURL(existing).toString();

  const response = await fetch(url, { signal: AbortSignal.timeout(10_000), redirect: "follow" });
  if (!response.ok) throw new Error(`The asset server returned ${response.status}.`);
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_REMOTE_ASSET_BYTES) throw new Error("The remote asset is larger than 15 MB.");
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("image/") && !contentType.startsWith("video/")) throw new Error("The URL did not return an image or video asset.");
  const data = Buffer.from(await response.arrayBuffer());
  if (data.length > MAX_REMOTE_ASSET_BYTES) throw new Error("The remote asset is larger than 15 MB.");
  const extension = contentType.includes("webm") ? ".webm" : contentType.includes("gif") ? ".gif" : contentType.includes("png") ? ".png" : contentType.includes("jpeg") ? ".jpg" : contentType.includes("webp") ? ".webp" : ".bin";
  if (!ALLOWED_EXTENSIONS.has(extension)) throw new Error("The remote asset format is not supported.");
  const target = path.join(cacheDirectory, `${hash}${extension}`);
  writeFileSync(target, data, { mode: 0o600 });
  return pathToFileURL(target).toString();
}

async function toView(companion: Companion): Promise<CompanionView> {
  let assetUrl = bundledAssetUrl();
  try {
    if (companion.assetType === "local") assetUrl = pathToFileURL(validateLocalAsset(companion.assetPath)).toString();
    if (companion.assetType === "url") assetUrl = await cacheRemoteAsset(companion.assetPath);
  } catch {
    assetUrl = bundledAssetUrl();
  }
  return { ...companion, assetUrl, settings: manager.snapshot().settings };
}

async function sendState(id: string): Promise<CompanionView | undefined> {
  const companion = manager.get(id);
  const window = companionWindows.get(id);
  if (!companion || !window || window.isDestroyed()) return undefined;
  const view = await toView(companion);
  window.webContents.send("companion:state", view);
  return view;
}

function applyCompanion(companion: Companion, window: BrowserWindow): void {
  window.setBounds(boundsFor(companion, displayFor(window)));
  window.setAlwaysOnTop(manager.snapshot().settings.alwaysOnTop);
}

function createCompanionWindow(companion: Companion): BrowserWindow {
  const window = new BrowserWindow({
    ...boundsFor(companion), frame: false, transparent: true, skipTaskbar: true, resizable: false,
    movable: true, hasShadow: false, show: false,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  companionWindows.set(companion.id, window);
  window.setMenuBarVisibility(false);
  window.setAlwaysOnTop(manager.snapshot().settings.alwaysOnTop);
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.loadFile(path.join(__dirname, "renderer", "companion-window.html"));
  window.once("ready-to-show", () => { window.showInactive(); void sendState(companion.id); });
  window.on("focus", () => { if (!companion.locked) { manager.bringToFront(companion.id); void sendState(companion.id); } });
  window.on("closed", () => { companionWindows.delete(companion.id); });
  return window;
}

function removeCompanion(id: string): void {
  manager.remove(id);
  const window = companionWindows.get(id);
  if (window && !window.isDestroyed()) window.destroy();
}

function restoreWindows(): void {
  const companions = manager.list();
  const restore = companions.length ? companions : [manager.create()];
  restore.sort((a, b) => a.zIndex - b.zIndex).forEach(createCompanionWindow);
}

function showSettings(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) { settingsWindow.show(); settingsWindow.focus(); return; }
  settingsWindow = new BrowserWindow({ width: 430, height: 330, title: "Companion settings", webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  settingsWindow.setMenuBarVisibility(false);
  settingsWindow.loadFile(path.join(__dirname, "renderer", "settings.html"));
  settingsWindow.on("closed", () => { settingsWindow = undefined; });
}

function createTray(): void {
  const icon = nativeImage.createFromPath(path.join(__dirname, "assets", "default.svg")).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip("Sonion Companion");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Add companion", click: () => { const companion = manager.create(); createCompanionWindow(companion); } },
    { label: "Settings", click: showSettings },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() }
  ]));
  tray.on("click", showSettings);
}

function registerIpc(): void {
  ipcMain.handle("companion:get-state", async (event) => { const found = senderCompanion(event); return found ? sendState(found[0]) : undefined; });
  ipcMain.handle("companion:move-by", async (event, delta: PointDelta) => {
    const found = senderCompanion(event); if (!found || !isFiniteNumber(delta?.x) || !isFiniteNumber(delta?.y)) return undefined;
    const [id, window] = found; const current = manager.get(id); if (!current || current.locked) return sendState(id);
    const bounds = window.getBounds(); const display = displayFor(window); const moved = { ...bounds, x: Math.round(bounds.x + Math.max(-500, Math.min(500, delta.x))), y: Math.round(bounds.y + Math.max(-500, Math.min(500, delta.y))) };
    const position = normalizedPosition(moved, current.size, display); const updated = manager.update(id, position); applyCompanion(updated, window); return sendState(id);
  });
  ipcMain.handle("companion:resize", async (event, delta: number) => {
    const found = senderCompanion(event); if (!found || !isFiniteNumber(delta)) return undefined;
    const [id, window] = found; const current = manager.get(id); if (!current || current.locked) return sendState(id);
    const settings = manager.snapshot().settings; const size = Math.round(Math.max(settings.minSize, Math.min(settings.maxSize, current.size + Math.max(-100, Math.min(100, delta)))));
    const oldBounds = window.getBounds(); const display = displayFor(window); const position = normalizedPosition({ ...oldBounds, x: oldBounds.x - Math.round((size - current.size) / 2), y: oldBounds.y - Math.round((size - current.size) / 2) }, size, display);
    const updated = manager.update(id, { size, ...position }); applyCompanion(updated, window); return sendState(id);
  });
  ipcMain.handle("companion:set-hover-opacity", (event, opacity: number) => { const found = senderCompanion(event); return found && isFiniteNumber(opacity) ? undefined : undefined; });
  ipcMain.handle("companion:toggle-lock", async (event) => { const found = senderCompanion(event); if (!found) return undefined; const current = manager.get(found[0]); if (!current) return undefined; manager.update(found[0], { locked: !current.locked }); return sendState(found[0]); });
  ipcMain.handle("companion:bring-to-front", async (event) => { const found = senderCompanion(event); if (!found) return undefined; companionWindows.get(found[0])?.focus(); manager.bringToFront(found[0]); return sendState(found[0]); });
  ipcMain.handle("companion:remove", (event) => { const found = senderCompanion(event); if (found) removeCompanion(found[0]); });
  ipcMain.handle("companion:choose-local-asset", async (event) => {
    const found = senderCompanion(event); if (!found) return undefined; const result = await dialog.showOpenDialog(found[1], { properties: ["openFile"], filters: [{ name: "Companion assets", extensions: [...ALLOWED_EXTENSIONS].map((x) => x.slice(1)) }] });
    if (result.canceled || !result.filePaths[0]) return sendState(found[0]); manager.update(found[0], { assetPath: validateLocalAsset(result.filePaths[0]), assetType: "local" }); return sendState(found[0]);
  });
  ipcMain.handle("companion:set-asset-url", async (event, value: string) => { const found = senderCompanion(event); if (!found || typeof value !== "string") return undefined; validateRemoteUrl(value); manager.update(found[0], { assetPath: value.trim(), assetType: "url" }); return sendState(found[0]); });
  ipcMain.handle("companion:clear-local-asset", async (event) => { const found = senderCompanion(event); if (!found) return undefined; manager.update(found[0], { assetPath: "assets/default.svg", assetType: "bundled" }); return sendState(found[0]); });
  ipcMain.handle("companion:report-asset-error", async (event) => { const found = senderCompanion(event); if (!found) return undefined; manager.update(found[0], { assetPath: "assets/default.svg", assetType: "bundled" }); return sendState(found[0]); });
  ipcMain.handle("app:get-settings", () => manager.snapshot());
  ipcMain.handle("app:update-settings", (_event, updates: Partial<CompanionSettings>) => { const settings = manager.updateSettings(updates ?? {}); for (const [id, window] of companionWindows) { const companion = manager.get(id); if (companion && !window.isDestroyed()) { applyCompanion(companion, window); void sendState(id); } } return settings; });
  ipcMain.handle("app:add-companion", () => { const companion = manager.create(); createCompanionWindow(companion); return companion.id; });
  ipcMain.handle("app:list-profiles", () => manager.listProfiles());
  ipcMain.handle("app:save-profile", (_event, name: string) => { manager.saveProfile(name); return manager.listProfiles(); });
  ipcMain.handle("app:load-profile", (_event, name: string) => { manager.loadProfile(name); for (const window of companionWindows.values()) window.destroy(); restoreWindows(); return manager.snapshot(); });
  ipcMain.handle("app:delete-profile", (_event, name: string) => manager.deleteProfile(name));
}

app.whenReady().then(() => { manager = new CompanionManager(app.getPath("userData")); registerIpc(); restoreWindows(); createTray(); globalShortcut.register("CommandOrControl+Shift+A", () => { const companion = manager.create(); createCompanionWindow(companion); }); globalShortcut.register("CommandOrControl+Shift+S", showSettings); app.on("activate", () => { if (!companionWindows.size) restoreWindows(); }); });
app.on("window-all-closed", () => { /* The tray keeps the companion service available. */ });
app.on("before-quit", () => { globalShortcut.unregisterAll(); tray?.destroy(); tray = undefined; });
