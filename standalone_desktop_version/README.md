# Standalone Sonion Companion

A minimalist, borderless floating companion player. Each companion is a transparent, frameless window that can display PNG, JPEG, GIF, WebP, BMP, SVG, or WebM assets. Companions stay on top of other windows and disappear from the taskbar.

## Run

```powershell
npm install
npm start
```

Use `npm.cmd` instead of `npm` if PowerShell execution policies block the npm shim.

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
- **Keyboard shortcuts** — global hotkeys for quick actions

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
| `Ctrl`/`Cmd` + `Shift` + `A` | Add a new companion |
| `Ctrl`/`Cmd` + `Shift` + `S` | Open settings |
| `Escape` | Close menu or dialog |

### System Tray

- **Add companion** — spawn a new companion
- **Settings** — open the settings window
- **Quit** — exit the application

## Settings

Accessible via `Ctrl+Shift+S` or the tray icon. Options include:

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

```powershell
npm run build       # Compile TypeScript + copy static assets
npm run typecheck   # Type-check without emitting
npm start           # Build and launch
```

## Known Limitations

- Transparent windows may behave differently across Linux compositors (X11 vs Wayland)
- Very large GIFs may impact performance
- DPI scaling on Windows can occasionally cause minor visual differences
