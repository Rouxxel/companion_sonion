# Standalone Sonion Companion

A minimalist, borderless floating companion player. Each companion is a transparent, frameless window that can display PNG, JPEG, GIF, WebP, BMP, SVG, or WebM assets. Companions stay on top of other windows and disappear from the taskbar.

## Run

### Installed app (recommended)

Build a Windows installer once:

```powershell
cd standalone_desktop_version/windows
npm install
npm run package
```

After it finishes, run the installer from `release/Sonion Companion Setup 0.1.0.exe`. The installer adds a **Start menu** and optional **desktop shortcut**. Pin that shortcut to your taskbar to launch the app like any other program.

When running, Sonion Companion lives in the **system tray** (near the clock). Right-click the tray icon for Add companion, Settings, or Quit.

Only one copy runs at a time. Launching it again (Start menu, desktop shortcut or a pinned taskbar icon) while it's already running opens the **Settings** window of the running copy instead of starting a second one. The first time you open it with no companions saved, Settings opens automatically.

### Development

See [Development](#development) below.

### Portable `.exe` (no installer)

```powershell
npm run package:portable
```

This creates `release/Sonion Companion 0.1.0.exe` — a single portable executable you can move anywhere and double-click to run.

## Features

- **Transparent frameless windows** — no title bar, no borders, no taskbar presence
- **Always on top** — companions float above all other applications (toggleable)
- **Multiple companions** — spawn as many as you want, each in its own window
- **Drag to reposition** — click and hold to move companions freely
- **Mouse wheel resize** — scroll up to enlarge, scroll down to shrink (40–500px range)
- **Aspect-ratio aware** — window adapts to image dimensions (portrait, landscape, square)
- **Hover opacity** — companions fade to 30% on hover so they don't block content
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

`Delete`, `L`, `Ctrl+O`, `Ctrl+U` and `Escape` only work while a companion has focus. The two `Ctrl+Alt+Shift` shortcuts are system-wide: they work from any app while Sonion Companion runs. Earlier versions used `Ctrl+Shift+A` / `Ctrl+Shift+S`, which took over shortcuts like *Save As* in other programs. If another app already uses one of these combinations, Sonion Companion skips it and the other app keeps it. On keyboard layouts with an AltGr key, `Ctrl+Alt` acts as AltGr, so these combinations may type characters there.

### System Tray

- **Add companion** — spawn a new companion
- **Settings** — open the settings window
- **Quit** — exit the application

## Settings

Accessible via `Ctrl+Alt+Shift+S`, the tray icon, or by launching the app again from the Start menu or taskbar. Options include:

- **Always on top** — keep companions above other windows
- **Default size** — size for newly spawned companions
- **Min/Max size** — resize limits
- **Max companions** — soft limit on total companions
- **Profiles** — save, load, and delete named layouts

## Data Storage

All data is stored in Electron's user-data directory:

- **Windows:** `%APPDATA%/Sonion Companion/`
- **macOS:** `~/Library/Application Support/Sonion Companion/`
- **Linux:** `~/.config/Sonion Companion/`

Files:
- `companions.json` — current state and settings
- `asset-cache/` — cached remote assets

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
npm run package:dir     # Unpacked app in release/win-unpacked/ (fast check, no installer)
npm run package         # Installer in release/
npm run package:portable  # Portable .exe in release/
```

Everything the build needs lives in this folder:

- `src/` — main process, preload and renderer code
- `resources/assets/` — default companion image and tray icon (copied into the app)
- `resources/build/icon.ico` — app/installer icon (16–256 px)

If `npm start` fails with `Cannot read properties of undefined (reading 'getPath')`, the environment variable `ELECTRON_RUN_AS_NODE` is set (some editors set it for their terminals); clear it with `Remove-Item Env:ELECTRON_RUN_AS_NODE` and try again.

## Known Limitations

- Transparent windows may behave differently across Linux compositors (X11 vs Wayland)
- Very large GIFs may impact performance
- DPI scaling on Windows can occasionally cause minor visual differences
