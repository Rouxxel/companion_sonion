import type { BrowserWindow, NativeImage } from "electron";
import type { CompanionManager, IdleSleepSettings, ShortcutSettings } from "./companion-manager";

/** What the shared app exposes to a platform adapter after Electron is ready. */
export interface AppContext {
  manager: CompanionManager;
  showSettings(): void;
  addCompanion(): void;
}

/** "Start at login" for one OS (Windows Run key, macOS login item, Linux XDG autostart). */
export interface AutostartAdapter {
  /** Label used in the tray menu and Settings, e.g. "Start with Windows" or "Open at Login". */
  label: string;
  /** False where it can't work (e.g. running from source); the controls are disabled then. */
  available(): boolean;
  /** The OS's current state (the OS is the source of truth after the first launch). */
  isEnabled(): boolean;
  /** Changes the OS setting and returns the state the OS reports afterwards. */
  setEnabled(enabled: boolean): boolean;
  /** Optional explanation shown under the Settings checkbox (unavailable, portable build, needs approval…). */
  note(): string | undefined;
  /** First-run default for installed builds, then syncs the saved setting with the OS. */
  initialize(manager: CompanionManager): void;
}

/** Everything that differs between Windows, macOS and Linux. Implemented once per desktop app. */
export interface PlatformAdapter {
  id: "win32" | "darwin" | "linux";
  /** Folder with this app's bundled assets (`sonion.jpeg`, tray icon), usually `<app>/dist/assets`. */
  assetsDir: string;
  /** Window/taskbar icon for unpackaged (source) runs; packaged builds use the icon embedded by electron-builder. */
  devWindowIcon?: string;
  /** Before Electron is ready (only the primary instance): command-line switches, AppUserModelID, … */
  beforeReady?(): void;
  /** After Electron is ready and the tray exists: Dock/menu bar/app menu, reopen handlers, … */
  afterReady?(ctx: AppContext): void;
  /** Defaults for missing/invalid saved values (shortcuts use ⌘ on macOS, for example). */
  defaults: { shortcuts: ShortcutSettings; idleSleep?: IdleSleepSettings };
  trayIcon(): NativeImage;
  /** Applies "keep on top" (and any OS-specific window level/Spaces behavior) to a companion window. */
  applyAlwaysOnTop?(window: BrowserWindow, alwaysOnTop: boolean): void;
  /** True when the OS started the app at login (don't open Settings then). */
  launchedAtLogin(): boolean;
  autostart: AutostartAdapter;
  /** Whether this build can update itself (installed builds only). */
  updatesAvailable(): boolean;
}
