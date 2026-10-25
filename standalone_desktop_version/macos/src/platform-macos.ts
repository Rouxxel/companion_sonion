import { app, Menu, nativeImage } from "electron";
import path from "node:path";
import { launchedAtLogin, PlatformAdapter, PRODUCT_NAME } from "@sonion/companion-core";

const assetsDir = path.join(__dirname, "assets");

/**
 * macOS specifics: menu-bar app without a Dock icon (LSUIElement in the packaged app), template
 * menu-bar icon, companions on every Space and over full-screen apps, ⌘-based shortcut defaults,
 * and an application menu so ⌘C/⌘V/⌘A/⌘Z work in text fields.
 */
export const macPlatform: PlatformAdapter = {
  id: "darwin",
  assetsDir,
  devWindowIcon: path.join(__dirname, "..", "resources", "build", "icon.png"),
  defaults: {
    shortcuts: { enabled: true, addCompanion: "Command+Alt+Shift+A", openSettings: "Command+Alt+Shift+S" }
  },
  // "…Template.png" (+ @2x) is black + alpha; macOS tints it for light/dark menu bars.
  trayIcon: () => {
    const icon = nativeImage.createFromPath(path.join(assetsDir, "trayTemplate.png"));
    icon.setTemplateImage(true);
    return icon;
  },
  afterReady(ctx) {
    // The packaged app sets LSUIElement (no Dock icon, not in ⌘-Tab); source runs hide the Dock icon here.
    if (!app.isPackaged) app.dock?.hide();
    // Without an application menu, macOS has no Edit shortcuts (⌘C/⌘V/⌘A/⌘Z) in Settings and the URL dialog.
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      {
        label: PRODUCT_NAME,
        submenu: [
          { role: "about" },
          { type: "separator" },
          { label: "Settings…", accelerator: "Command+,", click: () => ctx.showSettings() },
          { label: "Add Companion", click: () => ctx.addCompanion() },
          { type: "separator" },
          { role: "hide" },
          { role: "hideOthers" },
          { role: "unhide" },
          { type: "separator" },
          { role: "quit" }
        ]
      },
      { role: "editMenu" },
      { role: "windowMenu" }
    ]));
    // macOS delivers "open the app again" (Finder, Launchpad, Spotlight) as `activate`, not `second-instance`.
    app.on("activate", () => ctx.showSettings());
  },
  focusApp: () => app.focus({ steal: true }),
  applyAlwaysOnTop(window, alwaysOnTop) {
    // Companions follow you to every Space and stay visible over full-screen apps.
    window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    if (alwaysOnTop) window.setAlwaysOnTop(true, "floating");
    else window.setAlwaysOnTop(false);
  },
  // Login item support (`wasOpenedAtLogin`) arrives with "Open at Login"; `--autostart` keeps parity with the other platforms.
  launchedAtLogin: () => launchedAtLogin() || app.getLoginItemSettings().wasOpenedAtLogin === true,
  autostart: {
    label: "Open at Login",
    available: () => false,
    isEnabled: () => false,
    setEnabled: () => false,
    note: () => "Not available yet in this version.",
    initialize: (manager) => { manager.updateSettings({ startWithWindows: false }); }
  },
  updatesAvailable: () => false
};
