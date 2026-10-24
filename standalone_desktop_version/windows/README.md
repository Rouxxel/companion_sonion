# Standalone Sonion Companion

A minimalist, borderless floating companion player. Each companion is a transparent, frameless window that can display PNG, JPEG, GIF, WebP, BMP, SVG, or WebM assets. Companions stay on top of other windows and disappear from the taskbar.

## Install

### Installer (recommended)

Build the Windows installer:

```powershell
cd standalone_desktop_version/windows
npm install
npm run package
```

This creates `release/SonionCompanion-Setup-<version>.exe` (for example `SonionCompanion-Setup-0.2.0.exe`). Run it and follow the steps:

- It installs **for your user only**, so no administrator rights are needed. The default folder is `%LOCALAPPDATA%\Programs\Sonion Companion`, and you can choose another one.
- It adds a **Start menu** entry and a **desktop shortcut**, and lists the app under **Settings → Apps → Installed apps**.
- **Windows SmartScreen** may show "Windows protected your PC", because the installer isn't code-signed. Click **More info → Run anyway**.

**Pin to the taskbar:** open the Start menu, right-click **Sonion Companion** → **Pin to taskbar** (Windows doesn't let installers pin apps themselves). Clicking the pin while the app runs opens its Settings window.

**Start with Windows:** the installed app starts automatically when you sign in to Windows. It turns this on the first time you open it. To turn it off, uncheck **Start with Windows** in the tray menu, or disable it in **Task Manager → Startup apps**. Your choice is kept: the app never turns it back on by itself.

**Updating:** run a newer installer over the existing installation. Your companions, layouts and the Start with Windows choice are kept.

### Uninstall

Use **Settings → Apps → Installed apps → Sonion Companion → Uninstall** (or *Uninstall Sonion Companion* in the install folder).

- It removes the program, its shortcuts, its Installed apps entry and the Start with Windows entry.
- It then asks **"Also delete your companions, layouts and cached assets?"**. The default is **No**, which keeps `%APPDATA%\Sonion Companion` for a future reinstall.
- Silent uninstalls (`"Uninstall Sonion Companion.exe" /S`) always keep that data.

### Portable `.exe` (no installer)

```powershell
npm run package:portable
```

This creates `release/SonionCompanion-Portable-<version>.exe`, a single executable you can move anywhere and double-click to run. It doesn't start with Windows unless you turn that on in the tray menu; if you move the file afterwards, turn it on again.

## Run

When running, Sonion Companion lives in the **system tray** (near the clock). Right-click the tray icon for Add companion, Settings, Start with Windows, or Quit.

Only one copy runs at a time. Launching it again (Start menu, desktop shortcut or a pinned taskbar icon) while it's already running opens the **Settings** window of the running copy instead of starting a second one. The first time you open it with no companions saved, Settings opens automatically (but not when Windows starts it at sign-in).

For running from source, see [Development](#development).

## Features

- **Transparent frameless windows** — no title bar, no borders, no taskbar presence
- **Always on top** — companions float above all other applications (toggleable)
- **Multiple companions** — spawn as many as you want, each in its own window
- **Drag to reposition** — click and hold to move companions freely
- **Mouse wheel resize** — scroll up to enlarge, scroll down to shrink (40–500px range)
- **Aspect-ratio aware** — window adapts to image dimensions (portrait, landscape, square)
- **Hover opacity** — companions fade (30 % by default, adjustable in Settings) on hover so they don't block content
- **Multiple monitors** — companions remember which monitor they're on
- **Lock/Unlock** — prevent accidental movement
- **Context menu** — right-click for all actions
- **Local and remote assets** — import from disk or paste a URL
- **Asset caching** — remote URLs are cached locally after first download
- **Auto-persistence** — state saves automatically to `companions.json`
- **Profiles** — save/load named companion layouts via the Settings window
- **System tray** — add companions, open settings, or quit from the tray icon
- **Keyboard shortcuts** — system-wide hotkeys to add a companion or open Settings, chosen so they don't clash with common app shortcuts

## Controls

### Mouse

| Action | Effect |
|--------|--------|
| Left-click + drag | Move companion |
| Mouse wheel (hover) | Resize companion |
| Right-click | Open context menu |
| Double-click | *(reserved)* |

### Context Menu

- **Lock position** / **Unlock position** — toggle movement lock
- **Always on top** — toggle whether companions stay above other windows
- **Bring to front** — raise this companion above others
- **Change asset URL** — enter a remote image/GIF URL
- **Import local asset** — pick a file from disk
- **Clear current asset** — revert to the bundled default image
- **Add another companion** — spawn a new companion
- **Delete companion** — remove this companion
- **Close** — dismiss the menu

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Delete` | Remove focused companion |
| `L` | Toggle lock |
| `Ctrl`/`Cmd` + `O` | Import local asset |
| `Ctrl`/`Cmd` + `U` | Set asset URL |
| `Ctrl` + `Alt` + `Shift` + `A` | Add a new companion (works from any app) |
| `Ctrl` + `Alt` + `Shift` + `S` | Open settings (works from any app) |
| `Escape` | Close menu or dialog |

`Delete`, `L`, `Ctrl+O`, `Ctrl+U` and `Escape` only work while a companion has focus. The two `Ctrl+Alt+Shift` shortcuts are system-wide: they work from any app while Sonion Companion runs. Earlier versions used `Ctrl+Shift+A` / `Ctrl+Shift+S`, which took over shortcuts like *Save As* in other programs. If another app already uses one of these combinations, Sonion Companion skips it and the other app keeps it; Settings shows which shortcuts are active, and lets you change or turn them off. On keyboard layouts with an AltGr key, `Ctrl+Alt` acts as AltGr, so these combinations may type characters there.

### System Tray

- **Add companion** — spawn a new companion
- **Settings** — open the settings window
- **Start with Windows** — start automatically when you sign in (installed and portable app only; not available when running from source)
- **Quit** — exit the application

## Settings

Accessible via `Ctrl+Alt+Shift+S`, the tray icon, or by launching the app again from the Start menu or taskbar. Options include:

- **Keep companions on top** — keep companions above other windows
- **Default size** — size for newly spawned companions
- **Min/Max size** — resize limits
- **Max companions** — limit on total companions
- **Opacity on hover** — how transparent a companion gets while the mouse is over it (5–100 %, default 30 %); applies immediately to all companions
- **Start with Windows** — same switch as in the tray menu; only available in the installed (or portable) app
- **Keyboard shortcuts** — turn the system-wide shortcuts on or off and change them. Each shortcut shows *Active* or *Not available* (another app uses it, or the combination isn't valid). Use Electron accelerator names such as `Control+Alt+Shift+A`
- **Layouts** — save, load, and delete named layouts. Loading a layout restores companions and their display settings; it doesn't change your shortcuts or Start with Windows
- **Open data folder** — opens the folder below in Explorer; the app version is shown at the bottom

The Settings window updates itself when you change Start with Windows from the tray while it's open.

## Data Storage

All data is stored in `%APPDATA%\Sonion Companion\` (use **Open data folder** in Settings):

- `companions.json` — companions, settings and layouts
- `asset-cache/` — cached remote assets
- `session-data/` — browser cache used by the app's windows

### Multiple monitors

Each companion remembers which monitor it's on and returns there after a restart. If that monitor isn't connected, the companion appears on the main monitor (or the monitor it's currently on) and moves back once you reconnect it. Positions saved by earlier versions are placed on the main monitor until you move the companion once.

## Supported Formats

PNG, JPEG, GIF, WebP, BMP, SVG, WebM

## Tech Stack

- **Electron** — cross-platform desktop framework
- **TypeScript** — main process and preload
- **Vanilla JS/CSS** — renderer (no framework)

## Development

Run everything from `standalone_desktop_version/windows`. Use `npm.cmd` instead of `npm` if PowerShell execution policies block the npm shim.

```powershell
npm install             # First time (also downloads the Electron binary)
npm start               # Build and launch
npm run build           # Compile TypeScript + copy renderer files and resources into dist/
npm run typecheck       # Type-check without emitting
npm test                # Unit tests (data storage, layouts, multi-monitor geometry, startup entry)
npm run test:install    # Installer round trip on this PC (see below)
npm run package:dir     # Unpacked app in release/win-unpacked/ (fast check, no installer)
npm run package         # Installer in release/
npm run package:portable  # Portable .exe in release/
```

`npm run test:install` runs `scripts/smoke-install.ps1` against the newest installer in `release/`. It installs the app silently for your user, checks the shortcuts, Installed apps entry, single instance, Start with Windows, an update over the existing install, and a silent uninstall, then prints PASS/FAIL for each check. It backs up and restores your `companions.json` and uninstalls the app at the end. It won't run while the app is already installed (add `-Force` to replace that installation). Pass `-KeepInstalled` to leave the app installed for manual checks. Use Windows Sandbox or a VM if you'd rather not touch your own profile.

Everything the build needs lives in this folder:

- `src/` — main process, preload and renderer code
- `resources/assets/` — default companion image and tray icon (copied into the app)
- `resources/build/icon.ico` — app/installer icon (16–256 px)

If `npm start` fails with `Cannot read properties of undefined (reading 'getPath')`, the environment variable `ELECTRON_RUN_AS_NODE` is set (some editors set it for their terminals); clear it with `Remove-Item Env:ELECTRON_RUN_AS_NODE` and try again.

If `npm run package` fails with `…__uninstaller.exe" -> no files found`, Windows Security's **Controlled folder access** (ransomware protection) blocked the installer build from writing into a protected folder such as Documents. You'll see a matching "blocked" notification in Windows Security. Either allow it there (Windows Security → Virus & threat protection → Ransomware protection → Allow an app through Controlled folder access), or build into an unprotected folder:

```powershell
npm run build
npx electron-builder --win nsis "-c.directories.output=$env:LOCALAPPDATA\SonionCompanion-build"
```

## Known Limitations

- Transparent windows may behave differently across Linux compositors (X11 vs Wayland)
- Very large GIFs may impact performance
- DPI scaling on Windows can occasionally cause minor visual differences
