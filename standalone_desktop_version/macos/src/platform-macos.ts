import { app, Menu, nativeImage } from "electron";
import path from "node:path";
import { launchedAtLogin, PlatformAdapter, PRODUCT_NAME } from "@sonion/companion-core";
import { runningAppIsDeveloperIdSigned } from "./code-signature";
import { loginItem } from "./login-item";
import { offerMoveToApplications } from "./move-to-applications";

const assetsDir = path.join(__dirname, "assets");
const devIcon = path.join(__dirname, "..", "resources", "build", "icon.png");
/** Companion windows that already joined all Spaces (see applyAlwaysOnTop). */
const onAllSpaces = new WeakSet<Electron.BrowserWindow>();

/**
 * macOS specifics: Dock icon with a Dock menu plus a template menu-bar icon, companions on every
 * Space and over full-screen apps, ⌘-based shortcut defaults, and an application menu so
 * ⌘C/⌘V/⌘A/⌘Z work in text fields.
 */
export const macPlatform: PlatformAdapter = {
  id: "darwin",
  assetsDir,
  devWindowIcon: devIcon,
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
    // Dock icon: the packaged app uses its bundle icon; source runs would otherwise show Electron's.
    if (!app.isPackaged) app.dock?.setIcon(devIcon);
    // Right-click on the Dock icon (macOS adds Quit, Options and Show All Windows itself).
    app.dock?.setMenu(Menu.buildFromTemplate([
      { label: "Add Companion", click: () => ctx.addCompanion() },
      { label: "Settings…", click: () => ctx.showSettings() }
    ]));
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
    // macOS delivers "open the app again" (Dock click, Finder, Launchpad, Spotlight) as `activate`, not `second-instance`.
    app.on("activate", () => ctx.showSettings());
    // Running from the DMG or Downloads: offer to move into /Applications (login item and updates need it).
    void offerMoveToApplications();
  },
  // Evaluation switch: SONION_MAC_PANEL=1 makes companions non-activating panels (never steal focus from the
  // app you're using). Off by default until keyboard shortcuts in companion windows are verified with it.
  companionWindowOptions: () => (process.env.SONION_MAC_PANEL === "1" ? { type: "panel" } : {}),
  focusApp: () => app.focus({ steal: true }),
  applyAlwaysOnTop(window, alwaysOnTop) {
    // Companions follow you to every Space and stay visible over full-screen apps. With a Dock icon,
    // Electron briefly switches the process type for `visibleOnFullScreen` (the Dock icon blinks), so
    // do it once per window, not on every "keep on top" refresh (resize, settings save).
    if (!onAllSpaces.has(window)) {
      window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      onAllSpaces.add(window);
    }
    if (alwaysOnTop) window.setAlwaysOnTop(true, "floating");
    else window.setAlwaysOnTop(false);
  },
  // Started as a login item: don't open Settings. (`--autostart` keeps parity with the other platforms.)
  launchedAtLogin: () => launchedAtLogin() || app.getLoginItemSettings().wasOpenedAtLogin === true,
  autostart: loginItem,
  // Squirrel.Mac only updates a Developer ID–signed app, and only reliably from /Applications.
  updatesAvailable: () => app.isPackaged && app.isInApplicationsFolder() && runningAppIsDeveloperIdSigned()
};
