import { app, BrowserWindow, dialog, globalShortcut, ipcMain, Menu, powerMonitor, screen, shell, Tray } from "electron";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PRODUCT_NAME } from "./app-identity";
import { Companion, CompanionManager, CompanionSettings, ShortcutSettings } from "./companion-manager";
import { boundsInWorkArea, companionDimensions, DisplayInfo, normalizedPosition, pickDisplay, saveDisplay, Size } from "./geometry";
import type { PlatformAdapter } from "./platform";
import { checkForUpdates } from "./updater";

type PointDelta = { x: number; y: number };
type CompanionView = Companion & { assetUrl: string; settings: CompanionSettings; sleeping: boolean };

const MAX_LOCAL_ASSET_BYTES = 25 * 1024 * 1024;
const MAX_REMOTE_ASSET_BYTES = 15 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg", ".webm"]);
/** Renderer pages and the preload script ship inside this package. */
const RENDERER_DIR = path.join(__dirname, "..", "renderer");
const PRELOAD = path.join(__dirname, "preload.js");

let platform: PlatformAdapter;
let manager: CompanionManager;
const companionWindows = new Map<string, BrowserWindow>();
const companionAspectRatios = new Map<string, number>();
let tray: Tray | undefined;
let settingsWindow: BrowserWindow | undefined;
/** Whether each global shortcut could be registered (false = taken by another app or invalid). */
let shortcutStatus = { addCompanion: false, openSettings: false };
let systemSleeping = false;
let idleTimer: ReturnType<typeof setTimeout> | undefined;

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

function showError(title: string, error: unknown): void {
  const detail = /limit \(\d+\) reached/i.test(errorMessage(error))
    ? `${errorMessage(error)} You can raise the limit in Settings.`
    : errorMessage(error);
  void dialog.showMessageBox({ type: "warning", title: PRODUCT_NAME, message: title, detail, noLink: true });
}

/** Runs a user-triggered action (tray, shortcut, IPC) and shows a friendly message instead of a main-process crash dialog. */
function runAction(title: string, action: () => unknown): void {
  Promise.resolve().then(action).catch((error: unknown) => showError(title, error));
}

function addCompanion(): void {
  const companion = manager.create();
  createCompanionWindow(companion);
}

function applyOnTop(window: BrowserWindow, alwaysOnTop = manager.snapshot().settings.alwaysOnTop): void {
  if (platform.applyAlwaysOnTop) platform.applyAlwaysOnTop(window, alwaysOnTop);
  else window.setAlwaysOnTop(alwaysOnTop);
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

function displayFor(window: BrowserWindow): Electron.Display {
  return screen.getDisplayMatching(window.getBounds());
}

function displayInfo(display: Electron.Display): DisplayInfo {
  return { id: display.id, bounds: display.bounds, workArea: display.workArea };
}

/** The display a companion belongs on: its saved display if still connected, else `fallback` (see pickDisplay). */
function displayForCompanion(companion: Companion, fallback: Electron.Display = screen.getPrimaryDisplay()): Electron.Display {
  const displays = screen.getAllDisplays();
  const picked = pickDisplay(companion.display, displays.map(displayInfo), displayInfo(fallback));
  return displays.find((display) => display.id === picked.id) ?? fallback;
}

function companionWindowDimensions(companionId: string, companion: Pick<Companion, "size">): Size {
  return companionDimensions(companion.size, companionAspectRatios.get(companionId));
}

function boundsFor(companion: Companion, display: Electron.Display): Electron.Rectangle {
  return boundsInWorkArea(companion, companionWindowDimensions(companion.id, companion), display.workArea);
}

/** Relative position + display for window bounds, as stored in companions.json. */
function placementFor(bounds: Electron.Rectangle): Pick<Companion, "x" | "y" | "display"> {
  const display = screen.getDisplayMatching(bounds);
  return { ...normalizedPosition(bounds, display.workArea), display: saveDisplay(displayInfo(display)) };
}

function bundledAssetUrl(): string {
  return pathToFileURL(path.join(platform.assetsDir, "sonion.jpeg")).toString();
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
    // A cache/download failure must not prevent a valid remote image from displaying.
    assetUrl = companion.assetType === "url" ? companion.assetPath : bundledAssetUrl();
  }
  return { ...companion, assetUrl, settings: manager.snapshot().settings, sleeping: systemSleeping };
}

/**
 * Idle sleep: while the OS reports no keyboard/mouse input for the configured minutes,
 * companions doze. Polls every 15 s while awake and every second while asleep, so they wake
 * up right away when you're back.
 */
function updateIdleSleep(): void {
  if (idleTimer) clearTimeout(idleTimer);
  const { enabled, minutes } = manager.snapshot().settings.idleSleep;
  const sleeping = enabled && powerMonitor.getSystemIdleTime() >= minutes * 60;
  if (sleeping !== systemSleeping) {
    systemSleeping = sleeping;
    for (const id of companionWindows.keys()) void sendState(id);
  }
  idleTimer = setTimeout(updateIdleSleep, systemSleeping ? 1_000 : 15_000);
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
  window.setBounds(boundsFor(companion, displayForCompanion(companion, displayFor(window))));
  applyOnTop(window);
}

/**
 * Monitors were added, removed or rearranged: put every companion back on its saved display,
 * or on its current/primary display while that one is missing. The saved display isn't
 * overwritten here, so companions move back when the monitor is reconnected.
 */
function reapplyAllCompanions(): void {
  for (const [id, window] of companionWindows) {
    const companion = manager.get(id);
    if (companion && !window.isDestroyed()) applyCompanion(companion, window);
  }
}

function createCompanionWindow(companion: Companion): BrowserWindow {
  const window = new BrowserWindow({
    ...boundsFor(companion, displayForCompanion(companion)), frame: false, transparent: true, skipTaskbar: true, resizable: false,
    movable: false, hasShadow: false, show: false,
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  companionWindows.set(companion.id, window);
  window.setMenuBarVisibility(false);
  applyOnTop(window);
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.loadFile(path.join(RENDERER_DIR, "companion-window.html"));
  window.once("ready-to-show", () => { window.showInactive(); void sendState(companion.id); });
  window.on("focus", () => {
    // Read the current state: the `companion` captured at creation has a stale `locked` flag.
    const current = manager.get(companion.id);
    if (current && !current.locked) manager.bringToFront(companion.id);
  });
  window.on("closed", () => { companionWindows.delete(companion.id); });
  return window;
}

function removeCompanion(id: string): void {
  manager.remove(id);
  companionAspectRatios.delete(id);
  const window = companionWindows.get(id);
  if (window && !window.isDestroyed()) window.destroy();
}

function restoreWindows(): void {
  const companions = manager.list();
  const restore = companions.length ? companions : [manager.create()];
  restore.sort((a, b) => a.zIndex - b.zIndex).forEach(createCompanionWindow);
}

/**
 * The Settings window is the app's only taskbar-visible window: opening the app again (Start menu,
 * pinned taskbar icon, Finder, app menu) shows it.
 */
function showSettings(): void {
  platform.focusApp?.();
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    if (settingsWindow.isMinimized()) settingsWindow.restore();
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 480, height: 720, minWidth: 420, minHeight: 480, title: PRODUCT_NAME, show: false,
    // Packaged builds use the icon embedded by electron-builder; source runs would otherwise show Electron's.
    ...(app.isPackaged || !platform.devWindowIcon ? {} : { icon: platform.devWindowIcon }),
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  settingsWindow.setMenuBarVisibility(false);
  settingsWindow.loadFile(path.join(RENDERER_DIR, "settings.html"));
  settingsWindow.once("ready-to-show", () => { settingsWindow?.show(); settingsWindow?.focus(); });
  settingsWindow.on("closed", () => { settingsWindow = undefined; });
}

/** (Re)registers the global shortcuts from settings and records which ones succeeded. */
function applyShortcuts(shortcuts: ShortcutSettings): void {
  globalShortcut.unregisterAll();
  shortcutStatus = { addCompanion: false, openSettings: false };
  if (!shortcuts.enabled) return;
  const register = (accelerator: string, action: () => void): boolean => {
    try {
      return globalShortcut.register(accelerator, action);
    } catch {
      return false; // invalid accelerator string
    }
  };
  shortcutStatus = {
    addCompanion: register(shortcuts.addCompanion, () => runAction("Could not add a companion", addCompanion)),
    openSettings: register(shortcuts.openSettings, showSettings)
  };
  for (const [name, ok] of Object.entries(shortcutStatus)) {
    if (!ok) console.warn(`[shortcuts] ${name} (${shortcuts[name as keyof typeof shortcutStatus]}) could not be registered; another app may be using it.`);
  }
}

/**
 * Turns "start at login" on/off and stores what the OS actually reports.
 * (Saved as `startWithWindows` for backward compatibility; it means "start at login" on every OS.)
 */
function updateStartAtLogin(enabled: boolean): boolean {
  const actual = platform.autostart.setEnabled(enabled);
  manager.updateSettings({ startWithWindows: actual });
  refreshTrayMenu();
  notifySettingsChanged();
  return actual;
}

/** Lets an open Settings window refresh after a change made elsewhere (tray, shortcuts). */
function notifySettingsChanged(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.webContents.send("app:settings-changed");
}

function refreshTrayMenu(): void {
  if (!tray) return;
  const startAtLogin = manager.snapshot().settings.startWithWindows;
  const { label } = platform.autostart;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Add companion", click: () => runAction("Could not add a companion", addCompanion) },
    { label: "Settings", click: showSettings },
    { type: "separator" },
    {
      label, type: "checkbox", checked: startAtLogin, enabled: platform.autostart.available(),
      click: (item) => runAction(`Could not change ${label}`, () => updateStartAtLogin(item.checked))
    },
    { label: "Check for updates…", enabled: platform.updatesAvailable(), click: () => runAction("Could not check for updates", () => checkForUpdates(platform.updatesAvailable())) },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() }
  ]));
}

/** Replaces all companion windows after the whole set of companions changed (layout load, world import). */
function recreateCompanionWindows(): void {
  for (const window of companionWindows.values()) window.destroy();
  companionAspectRatios.clear();
  restoreWindows();
}

function readJsonFile(filePath: string): unknown {
  try {
    return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    throw new Error("The file isn't valid JSON.");
  }
}

async function exportWorld(): Promise<string | undefined> {
  const date = new Date().toISOString().slice(0, 10);
  const options = { title: "Export companions", defaultPath: path.join(app.getPath("documents"), `sonion-companions-${date}.json`), filters: [{ name: "Sonion Companion world", extensions: ["json"] }] };
  const result = settingsWindow && !settingsWindow.isDestroyed() ? await dialog.showSaveDialog(settingsWindow, options) : await dialog.showSaveDialog(options);
  if (result.canceled || !result.filePath) return undefined;
  writeFileSync(result.filePath, `${JSON.stringify(manager.exportWorld(), null, 2)}\n`, "utf8");
  return result.filePath;
}

async function importWorld(): Promise<{ companions: number; skipped: number; profiles: number } | undefined> {
  const options = { title: "Import companions", properties: ["openFile" as const], filters: [{ name: "Sonion Companion world", extensions: ["json"] }] };
  const parent = settingsWindow && !settingsWindow.isDestroyed() ? settingsWindow : undefined;
  const result = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options);
  if (result.canceled || !result.filePaths[0]) return undefined;
  const world = readJsonFile(result.filePaths[0]);
  const confirm = await dialog.showMessageBox({
    type: "question", title: PRODUCT_NAME, noLink: true, buttons: ["Replace", "Cancel"], defaultId: 1, cancelId: 1,
    message: "Replace your current companions with the imported ones?",
    detail: `Layouts from the file are added (layouts with the same name are replaced). Your shortcuts, ${platform.autostart.label} and idle sleep settings stay as they are. Tip: export first to keep a copy of your current companions.`
  });
  if (confirm.response !== 0) return undefined;
  const summary = manager.importWorld(world);
  recreateCompanionWindows();
  notifySettingsChanged();
  return summary;
}

function createTray(): void {
  tray = new Tray(platform.trayIcon());
  tray.setToolTip(PRODUCT_NAME);
  refreshTrayMenu();
  tray.on("click", showSettings);
}

function registerIpc(): void {
  ipcMain.handle("companion:get-state", async (event) => { const found = senderCompanion(event); return found ? sendState(found[0]) : undefined; });
  ipcMain.handle("companion:move-by", async (event, delta: PointDelta) => {
    const found = senderCompanion(event); if (!found || !isFiniteNumber(delta?.x) || !isFiniteNumber(delta?.y)) return undefined;
    const [id, window] = found; const current = manager.get(id); if (!current || current.locked) return undefined;
    const bounds = window.getBounds();
    const { width, height } = companionWindowDimensions(id, current);
    const newBounds = {
      x: Math.round(bounds.x + Math.max(-500, Math.min(500, delta.x))),
      y: Math.round(bounds.y + Math.max(-500, Math.min(500, delta.y))),
      width, height
    };
    // Keep canonical dimensions on every move to prevent Windows DPI rounding drift.
    window.setBounds(newBounds);
    // Position is stored relative to the display the companion is now on (it may have crossed monitors).
    manager.update(id, placementFor(newBounds));
    return undefined;
  });
  ipcMain.handle("companion:resize", async (event, delta: number) => {
    const found = senderCompanion(event); if (!found || !isFiniteNumber(delta)) return undefined;
    const [id, window] = found; const current = manager.get(id); if (!current || current.locked) return sendState(id);
    const settings = manager.snapshot().settings; const size = Math.round(Math.max(settings.minSize, Math.min(settings.maxSize, current.size + Math.max(-100, Math.min(100, delta)))));
    const oldBounds = window.getBounds();
    const { width: w, height: h } = companionWindowDimensions(id, { size });
    const cx = oldBounds.x + Math.round(oldBounds.width / 2);
    const cy = oldBounds.y + Math.round(oldBounds.height / 2);
    const newBounds = { x: cx - Math.round(w / 2), y: cy - Math.round(h / 2), width: w, height: h };
    manager.update(id, { size, ...placementFor(newBounds) }); window.setBounds(newBounds); applyOnTop(window, settings.alwaysOnTop); return sendState(id);
  });
  ipcMain.handle("companion:set-opacity", async (event, opacity: number) => {
    const found = senderCompanion(event); if (!found || !isFiniteNumber(opacity)) return undefined;
    manager.update(found[0], { opacity: Math.max(0.05, Math.min(1, opacity)) });
    return sendState(found[0]);
  });
  ipcMain.handle("companion:toggle-lock", async (event) => { const found = senderCompanion(event); if (!found) return undefined; const current = manager.get(found[0]); if (!current) return undefined; manager.update(found[0], { locked: !current.locked }); return sendState(found[0]); });
  ipcMain.handle("companion:toggle-always-on-top", async (event) => {
    const found = senderCompanion(event); if (!found) return undefined;
    const settings = manager.snapshot().settings;
    const updated = manager.updateSettings({ alwaysOnTop: !settings.alwaysOnTop });
    // Apply to all companion windows
    for (const win of companionWindows.values()) {
      if (!win.isDestroyed()) applyOnTop(win, updated.alwaysOnTop);
    }
    return sendState(found[0]);
  });
  ipcMain.handle("companion:bring-to-front", async (event) => {
    const found = senderCompanion(event); if (!found) return undefined;
    const [id, window] = found;
    window.focus();
    manager.bringToFront(id);
    // Return state without repositioning — just update zIndex info
    const companion = manager.get(id);
    if (!companion || window.isDestroyed()) return undefined;
    const view = await toView(companion);
    window.webContents.send("companion:state", view);
    return view;
  });
  ipcMain.handle("companion:expand-for-menu", (event, size: { width: number; height: number }) => {
    const found = senderCompanion(event); if (!found) return undefined;
    const [, window] = found;
    if (window.isDestroyed()) return undefined;
    const bounds = window.getBounds();
    const display = displayFor(window);
    const newWidth = Math.max(bounds.width, Math.min(display.workArea.width, Math.round(size.width)));
    const newHeight = Math.max(bounds.height, Math.min(display.workArea.height, Math.round(size.height)));
    if (newWidth > bounds.width || newHeight > bounds.height) {
      window.setBounds({ ...bounds, width: newWidth, height: newHeight });
    }
    const updated = window.getBounds();
    return { width: updated.width, height: updated.height };
  });
  ipcMain.handle("companion:restore-size", (event) => {
    const found = senderCompanion(event); if (!found) return;
    const [id, window] = found;
    if (window.isDestroyed()) return;
    const companion = manager.get(id);
    if (companion) applyCompanion(companion, window);
  });
  ipcMain.handle("companion:report-aspect-ratio", (event, dimensions: { width: number; height: number }) => {
    const found = senderCompanion(event); if (!found) return;
    const [id, window] = found;
    if (window.isDestroyed()) return;
    const companion = manager.get(id);
    if (!companion) return;
    if (!isFiniteNumber(dimensions?.width) || !isFiniteNumber(dimensions?.height) || dimensions.width <= 0 || dimensions.height <= 0) return;
    const aspectRatio = dimensions.width / dimensions.height;
    companionAspectRatios.set(id, aspectRatio);
    const { width: w, height: h } = companionWindowDimensions(id, companion);
    // Only resize if current bounds differ by more than 2px to prevent DPI rounding loops
    const bounds = window.getBounds();
    if (Math.abs(bounds.width - w) <= 2 && Math.abs(bounds.height - h) <= 2) return;
    const cx = bounds.x + Math.round(bounds.width / 2);
    const cy = bounds.y + Math.round(bounds.height / 2);
    window.setBounds({ x: cx - Math.round(w / 2), y: cy - Math.round(h / 2), width: w, height: h });
  });
  ipcMain.handle("companion:remove", (event) => { const found = senderCompanion(event); if (found) removeCompanion(found[0]); });
  ipcMain.handle("companion:add-companion", () => { runAction("Could not add a companion", addCompanion); });
  ipcMain.handle("companion:choose-local-asset", async (event) => {
    const found = senderCompanion(event); if (!found) return undefined; const result = await dialog.showOpenDialog(found[1], { properties: ["openFile"], filters: [{ name: "Companion assets", extensions: [...ALLOWED_EXTENSIONS].map((x) => x.slice(1)) }] });
    if (result.canceled || !result.filePaths[0]) return sendState(found[0]); manager.update(found[0], { assetPath: validateLocalAsset(result.filePaths[0]), assetType: "local" }); return sendState(found[0]);
  });
  ipcMain.handle("companion:set-asset-url", async (event, value: string) => { const found = senderCompanion(event); if (!found || typeof value !== "string") return undefined; const url = value.trim(); validateRemoteUrl(url); manager.update(found[0], { assetPath: url, assetType: "url" }); return sendState(found[0]); });
  ipcMain.handle("companion:clear-local-asset", async (event) => { const found = senderCompanion(event); if (!found) return undefined; manager.update(found[0], { assetPath: "assets/sonion.jpeg", assetType: "bundled" }); return sendState(found[0]); });
  ipcMain.handle("companion:report-asset-error", async (event) => { const found = senderCompanion(event); if (!found) return undefined; manager.update(found[0], { assetPath: "assets/sonion.jpeg", assetType: "bundled" }); return sendState(found[0]); });
  ipcMain.handle("app:get-settings", () => manager.snapshot());
  ipcMain.handle("app:get-info", () => ({
    version: app.getVersion(),
    dataPath: app.getPath("userData"),
    platform: platform.id,
    autostart: { label: platform.autostart.label, available: platform.autostart.available(), note: platform.autostart.note() },
    updatesAvailable: platform.updatesAvailable(),
    shortcuts: shortcutStatus
  }));
  ipcMain.handle("app:open-data-folder", async () => {
    const failure = await shell.openPath(app.getPath("userData"));
    if (failure) throw new Error(failure);
  });
  ipcMain.handle("app:update-settings", (_event, updates: Partial<CompanionSettings>) => {
    const before = manager.snapshot().settings.shortcuts;
    // Login-item state is owned by the OS; the renderer may request a change but never set the internal flag.
    const { startWithWindows, autostartInitialized: _ignored, ...rest } = updates ?? {};
    if (typeof startWithWindows === "boolean" && startWithWindows !== manager.snapshot().settings.startWithWindows) updateStartAtLogin(startWithWindows);
    const settings = manager.updateSettings(rest);
    updateIdleSleep();
    if (JSON.stringify(before) !== JSON.stringify(settings.shortcuts)) applyShortcuts(settings.shortcuts);
    for (const [id, window] of companionWindows) { const companion = manager.get(id); if (companion && !window.isDestroyed()) { applyCompanion(companion, window); void sendState(id); } }
    return settings;
  });
  ipcMain.handle("app:add-companion", () => { const companion = manager.create(); createCompanionWindow(companion); return companion.id; });
  ipcMain.handle("app:list-profiles", () => manager.listProfiles());
  ipcMain.handle("app:save-profile", (_event, name: string) => { manager.saveProfile(name); return manager.listProfiles(); });
  ipcMain.handle("app:load-profile", (_event, name: string) => { manager.loadProfile(name); recreateCompanionWindows(); return manager.snapshot(); });
  ipcMain.handle("app:export-world", () => exportWorld());
  ipcMain.handle("app:import-world", () => importWorld());
  ipcMain.handle("app:check-for-updates", () => checkForUpdates(platform.updatesAvailable()));
  ipcMain.handle("app:delete-profile", (_event, name: string) => manager.deleteProfile(name));
}

/** Starts the desktop app. Call once from each platform's main.ts, at module load (before Electron is ready). */
export function startApp(adapter: PlatformAdapter): void {
  platform = adapter;

  // Keep Chromium's HTTP/GPU cache away from Electron's shared default profile.
  // This must run before Electron is ready and prevents cache permission failures on Windows.
  const appDataPath = path.join(app.getPath("appData"), "Sonion Companion");
  const sessionDataPath = path.join(appDataPath, "session-data");
  mkdirSync(sessionDataPath, { recursive: true });
  app.setPath("userData", appDataPath);
  app.setPath("sessionData", sessionDataPath);
  app.commandLine.appendSwitch("disk-cache-dir", path.join(sessionDataPath, "cache"));

  // Only one process may own companions.json. The lock is tied to the userData path set above,
  // so it must be requested after setPath. A second launch (e.g. clicking the pinned taskbar icon
  // while the app runs) hands over to the running instance and exits.
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }

  platform.beforeReady?.();

  app.on("second-instance", () => { if (app.isReady()) showSettings(); });

  app.whenReady().then(() => {
    manager = new CompanionManager(app.getPath("userData"), { defaults: platform.defaults });
    if (manager.recoveredConfigPath) {
      void dialog.showMessageBox({
        type: "warning", title: PRODUCT_NAME, noLink: true,
        message: "Your companions file couldn't be read, so Sonion Companion started with default settings.",
        detail: `The unreadable file was kept as:\n${manager.recoveredConfigPath}`
      });
    }
    const firstRun = manager.list().length === 0;
    registerIpc();
    try {
      platform.autostart.initialize(manager);
    } catch (error) {
      console.warn(`[autostart] ${errorMessage(error)}`);
    }
    restoreWindows();
    createTray();
    applyShortcuts(manager.snapshot().settings.shortcuts);
    screen.on("display-added", reapplyAllCompanions);
    screen.on("display-removed", reapplyAllCompanions);
    screen.on("display-metrics-changed", reapplyAllCompanions);
    updateIdleSleep();
    platform.afterReady?.({ manager, showSettings, addCompanion: () => runAction("Could not add a companion", addCompanion) });
    // Opened by hand with nothing saved yet: show Settings so the app doesn't look like it did nothing.
    if (firstRun && !platform.launchedAtLogin()) showSettings();
    app.on("activate", () => { if (!companionWindows.size) restoreWindows(); });
  });
  app.on("window-all-closed", () => { /* The tray keeps the companion service available. */ });
  app.on("before-quit", () => { globalShortcut.unregisterAll(); tray?.destroy(); tray = undefined; });
}
