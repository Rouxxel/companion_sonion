# Change Log

All notable changes to the Sonion Companion desktop app (Windows) are documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

### Added

- Windows installer `SonionCompanion-Setup-<version>.exe`: installs for the current user without administrator rights, adds Start menu and desktop shortcuts, and appears in Settings → Apps with name, version, publisher and icon. The app can be pinned to the taskbar
- Uninstaller removes the program, shortcuts and the Start with Windows entry, and asks whether to also delete your companions, layouts and cached assets (default: keep). Silent uninstalls and updates keep your data
- Start with Windows: on by default for the installed app (set on first launch), with a **Start with Windows** checkbox in the tray menu. Turning it off (in the tray or Task Manager → Startup apps) is respected; the app never re-enables it by itself. Portable builds can opt in
- Only one copy runs at a time: launching the app again (Start menu, desktop or pinned taskbar icon) opens the Settings window of the running copy
- Settings opens automatically the first time the app is launched with no companions
- Proper app icon for the executable, installer, taskbar and tray
- Multiple monitors: each companion remembers its monitor and returns there after a restart; if that monitor is disconnected it's shown on the main monitor and moves back when the monitor is reconnected
- Settings window: Start with Windows, opacity on hover, keyboard shortcuts (turn on/off, change, and see whether each one is active), **Open data folder**, and the app version. It refreshes when Start with Windows is changed from the tray

### Changed

- Global shortcuts are now `Ctrl+Alt+Shift+A` (add companion) and `Ctrl+Alt+Shift+S` (open Settings). The previous `Ctrl+Shift+A` / `Ctrl+Shift+S` took over shortcuts such as *Save As* in other programs. Shortcuts already used by another app are skipped instead of failing
- Portable build is named `SonionCompanion-Portable-<version>.exe`
- Error messages are shown in a dialog instead of a main-process crash dialog (for example when the companion limit is reached), and the Settings window shows the actual reason when something fails

### Fixed

- The app couldn't be built: the build copied resources from outside the project with a wrong path
- Locking a companion now reliably stops it from being brought to the front on focus
- Asset URLs with leading or trailing spaces are accepted
- Loading a layout no longer reuses stale aspect ratios from the previous companions
- Error message typo for remote assets that aren't images or videos
- The hover opacity setting had no effect (companions always faded to 30 % and returned to full opacity instead of their own opacity)
- Resizing with the mouse wheel lagged one step behind (the window used the previous size)
- Loading a layout no longer changes shortcuts or Start with Windows

## [0.1.0]

- Initial version: transparent, frameless companion windows, tray icon, settings window, layouts (profiles), local and remote assets with caching, mouse and keyboard controls
