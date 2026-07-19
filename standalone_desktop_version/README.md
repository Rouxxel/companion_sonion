# Standalone Sonion Companion

A taskbar-free desktop companion player. Each companion is a transparent, frameless window that can display PNG, JPEG, GIF, WebP, BMP, SVG, or WebM assets.

## Run

```powershell
npm install
npm start
```

Use `npm.cmd` instead of `npm` if PowerShell execution policies block the npm shim.

## Controls

- Drag to reposition; mouse wheel resizes within the configured limits.
- Right-click a companion for lock, asset, fronting, and delete actions.
- `Delete` removes the selected companion; `L` toggles lock.
- `Ctrl`/`Cmd` + `O` imports a local asset; `Ctrl`/`Cmd` + `U` sets a remote URL.
- `Ctrl`/`Cmd` + `Shift` + `A` adds a companion; `Ctrl`/`Cmd` + `Shift` + `S` opens settings.

The tray menu also adds companions, opens settings, and quits the app. Settings include always-on-top and size/count limits. Layouts can be saved, loaded, and deleted there.

State is saved automatically to Electron's user-data directory in `companions.json`. Remote assets are cached under that directory after validation.
