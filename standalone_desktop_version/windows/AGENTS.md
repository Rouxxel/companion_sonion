# Agent notes — Sonion Companion (Windows desktop app)

Run everything from `standalone_desktop_version/windows` (PowerShell; use `npm.cmd` if the execution policy blocks `npm`).

## Verify

- `npm run typecheck` — TypeScript only
- `npm test` — build + `node:test` unit tests in `src/test/*.test.ts` (compiled to `dist/test/`, never packaged)
  - Unit-tested modules must not import `electron`: `companion-manager.ts`, `geometry.ts`, `startup-entry.ts`
- `npm start` — build and launch from source (Settings opens on a second launch)
- `npm run package:dir` — unpacked app in `release/win-unpacked/` (fast packaging check)
- `npm run package` — installer `release/SonionCompanion-Setup-<version>.exe`
- `npm run test:install` — `scripts/smoke-install.ps1`: silent install → first launch → single instance → Start with Windows → Task Manager "disabled" respected → update → silent uninstall. **Installs into the real user profile** (backs up and restores `companions.json`, uninstalls at the end); refuses to run if the app is already installed (`-Force`), `-KeepInstalled` for manual checks

## Environment gotchas

- `ELECTRON_RUN_AS_NODE=1` (set by some editor terminals) makes Electron start as plain Node (`app` is undefined) — `Remove-Item Env:ELECTRON_RUN_AS_NODE`
- Windows Security **Controlled folder access** blocks the NSIS uninstaller generator from writing into `Documents\…\release` → `…__uninstaller.exe -> no files found`. Build out of tree: `npx electron-builder --win nsis "-c.directories.output=$env:LOCALAPPDATA\SonionCompanion-build"`. Never change security settings to work around it
- `node_modules/electron/dist` missing → `node node_modules/electron/install.js`

## Conventions

- The build reads only this folder: `src/`, `resources/assets/` (copied into `dist/assets`), `resources/build/` (electron-builder: `icon.ico`, `installer.nsh`). `.gitignore` entries are root-anchored (`/build/`, …) so `resources/build/` stays tracked
- Identity constants live in `src/app-identity.ts` (`APP_ID` must equal `build.appId`; `AUTOSTART_NAME` must equal the value name in `installer.nsh`)
- Start with Windows: written with `app.setLoginItemSettings`, read via `reg.exe` (`src/autostart.ts`); Windows is the source of truth after the first launch
- Updates (`src/updater.ts`, `electron-updater` pinned exactly): manual only, generic feed = GitHub release tag `desktop-latest` (`build.publish`); a release needs `latest.yml`, the Setup `.exe` and its `.blockmap`. Installed app only (not portable/dev). Don't add background checks without asking
- Machine-level settings (`MACHINE_SETTINGS` in `companion-manager.ts`: shortcuts, Start with Windows, first-run flag, idle sleep) are never changed by loading a layout or importing a world file; add new per-PC preferences there
- Code signing: none configured. electron-builder signs when `CSC_LINK`/`CSC_KEY_PASSWORD` (or Azure Trusted Signing options) are provided; never commit certificates or secrets
- Keep Electron security defaults: `contextIsolation`, `sandbox`, no `nodeIntegration`, CSP in the HTML files, navigation/window-open blocked; validate every IPC input in the main process
- `companions.json` must stay backward compatible: new fields optional, filled in by `normalize*` in `companion-manager.ts`
- User-facing changes: update `README.md` and `CHANGELOG.md` `[Unreleased]` in the same change
