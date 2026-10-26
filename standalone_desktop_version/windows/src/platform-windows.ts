import { app, nativeImage } from "electron";
import path from "node:path";
import { APP_ID, DEFAULT_SHORTCUTS, launchedAtLogin, PlatformAdapter } from "@sonion/companion-core";
import { autostartAvailable, initializeAutostart, isStartWithWindowsEnabled, setStartWithWindows } from "./autostart";
import { isPortable } from "./windows-identity";

const assetsDir = path.join(__dirname, "assets");

/** Windows specifics: taskbar identity, Run-key autostart, portable build, tray icon. */
export const windowsPlatform: PlatformAdapter = {
  id: "win32",
  assetsDir,
  devWindowIcon: path.join(__dirname, "..", "resources", "build", "icon.ico"),
  beforeReady() {
    // Taskbar grouping: windows share the AppUserModelID of the installer's Start-menu/taskbar shortcut.
    app.setAppUserModelId(APP_ID);
  },
  defaults: { shortcuts: DEFAULT_SHORTCUTS },
  trayIcon: () => nativeImage.createFromPath(path.join(assetsDir, "tray-icon.png")).resize({ width: 16, height: 16 }),
  launchedAtLogin: () => launchedAtLogin(),
  autostart: {
    label: "Start with Windows",
    available: autostartAvailable,
    isEnabled: isStartWithWindowsEnabled,
    setEnabled: setStartWithWindows,
    note: () => !autostartAvailable()
      ? "Only available in the installed app (not when running from source)."
      : isPortable() ? "Portable app: if you move the .exe, turn this on again." : undefined,
    initialize: initializeAutostart
  },
  // Only the installed app can update itself (portable and source runs can't).
  updatesAvailable: () => app.isPackaged && !isPortable()
};
