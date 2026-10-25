# Sonion Companion (macOS)

Floating desktop companions for macOS: transparent, frameless windows showing a PNG, JPEG, GIF, WebP, BMP, SVG or WebM asset that float above other apps, on every Space and over full-screen apps. The app lives in the **menu bar** (no Dock icon). Features and settings are the same as the Windows app.

> **Status: development build.** There is no signed `.dmg` yet; run it from source or use the unsigned development build from CI (see below). "Open at Login" and updates aren't available yet.

## Requirements

- macOS 12 Monterey or later (Electron 43), Apple silicon or Intel.

## Run

- The app adds a **menu-bar icon** (a handshake that adapts to light and dark menu bars). Click it for Add companion, Settings and Quit.
- **Settings** opens with **⌘,**, from the menu-bar icon, or by opening the app again (Finder, Launchpad, Spotlight). Only one copy runs at a time.
- The first time you open it with no companions saved, Settings opens automatically.
- Companions stay above normal windows, appear on every Space and stay visible over full-screen apps. They never show up in the Dock or in ⌘-Tab.

### Development build from CI (unsigned)

The GitHub Actions workflow **Desktop macOS (dev build)** (run it manually from the Actions tab) builds the app on a Mac runner, launches it, and uploads screenshots plus `SonionCompanion-dev-arm64.zip` (Apple silicon). The app is only ad-hoc signed, so macOS blocks it when it's downloaded: unzip it, then right-click **Sonion Companion** → **Open** → **Open** (or allow it in System Settings → Privacy & Security).

## Controls

Same as on Windows, with ⌘ instead of Ctrl:

| Shortcut | Action | Works |
|----------|--------|-------|
| `⌘` + `⌥` + `⇧` + `A` | Add a new companion | From any app |
| `⌘` + `⌥` + `⇧` + `S` | Open Settings | From any app |
| `⌘` + `O` / `⌘` + `U` | Import local asset / set asset URL | Companion focused |
| `⌘` + `⌫` (or `fn` + `⌫`) | Remove the companion | Companion focused |
| `L` / `Escape` | Toggle lock / close menu | Companion focused |
| `⌘` + `C` / `⌘` + `V` / `⌘` + `A` | Copy / paste / select all in Settings and the URL dialog | |

Mouse: drag to move, scroll over a companion to resize, right-click (or Control-click) for the companion menu (lock, keep on top, asset, opacity, add, delete).

## Data storage

`~/Library/Application Support/Sonion Companion/` (**Open data folder** in Settings): `companions.json`, `asset-cache/`, `session-data/`. Files exported with **Export companions…** work on Windows and macOS alike.

## Development

The desktop apps share most of their code: `standalone_desktop_version/` is an npm workspace with the platform-neutral core in `shared/` (`@sonion/companion-core`) and one folder per OS.

```bash
cd standalone_desktop_version
npm install               # once, at the workspace root
npm test                  # unit tests (shared core + platforms)
cd macos
npm start                 # build and launch from source (needs a Mac)
npm run typecheck         # works on any OS
npm run package:dir       # unpacked app in release/ (needs a Mac)
```

Project layout:

- `../shared/` — app logic, data model, renderer pages, updater (shared with Windows)
- `src/platform-macos.ts` — the macOS adapter: menu-bar template icon, no Dock icon, app/Edit menu, `activate` → Settings, window level and Spaces, ⌘ shortcut defaults
- `resources/assets/` — default companion image, `trayTemplate.png` / `trayTemplate@2x.png` (black + alpha)
- `resources/build/icon.png` — 1024 × 1024 app icon (electron-builder turns it into `.icns`)

If `npm start` fails with `Cannot read properties of undefined (reading 'getPath')`, the environment variable `ELECTRON_RUN_AS_NODE` is set (some editors set it for their terminals); run `unset ELECTRON_RUN_AS_NODE` and try again.
