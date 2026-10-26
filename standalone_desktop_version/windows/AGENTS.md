# Agent notes — Sonion Companion (Windows desktop app)

`standalone_desktop_version/` is an **npm workspace** (`package.json` + the only `package-lock.json` there): `shared/` (`@sonion/companion-core`, platform-neutral core) + one app per OS (`windows/`, `macos/`). Install at the workspace root; run app commands from `standalone_desktop_version/windows` (PowerShell; use `npm.cmd` if the execution policy blocks `npm`).

## Verify

- `npm install` at `standalone_desktop_version/` (first time / after dependency changes). Dev dependencies are pinned exactly; keep the versions in `shared/` and `windows/` identical
- `npm test` at the workspace root — shared tests (`shared/src/test`, compiled to `shared/build-test/`) + Windows tests (`windows/src/test`, compiled to `windows/dist/test/`, never packaged)
  - Unit-tested modules must not import `electron`: `companion-manager.ts`, `geometry.ts` (shared), `startup-entry.ts` (windows)
- `npm run typecheck` (in `windows/`) — builds the shared core, then type-checks
- `npm start` — build and launch from source (Settings opens on a second launch)
- `npm run package:dir` — unpacked app in `release/win-unpacked/` (fast packaging check)
- `npm run package` — installer `release/SonionCompanion-Setup-<version>.exe`
  - Packaging check after touching the shared package or dependencies: `npx asar list <out>/win-unpacked/resources/app.asar` must contain `node_modules/@sonion/companion-core/{dist,renderer}` and `node_modules/electron-updater`, and no `src/`, `build-test/` or `dist/test`
- `npm run test:install` — `scripts/smoke-install.ps1`: silent install → first launch → single instance → Start with Windows → Task Manager "disabled" respected → update → silent uninstall. **Installs into the real user profile** (backs up and restores `companions.json`, uninstalls at the end, also when it stops early); refuses to run if the app is already installed (`-Force`), `-KeepInstalled` for manual checks

## Environment gotchas

- `ELECTRON_RUN_AS_NODE=1` (set by some editor terminals) makes Electron start as plain Node (`app` is undefined) — `Remove-Item Env:ELECTRON_RUN_AS_NODE`
- Windows Security **Controlled folder access** blocks the NSIS uninstaller generator from writing into `Documents\…\release` → `…__uninstaller.exe -> no files found`. Build out of tree: `npx electron-builder --win nsis "-c.directories.output=$env:LOCALAPPDATA\SonionCompanion-build"`. Never change security settings to work around it
- Electron binary missing (`node_modules/electron/dist`, now at the **workspace root**) → `node node_modules/electron/install.js` from `standalone_desktop_version/`

## Where code lives

- `../shared/src/app.ts` — everything the app does (windows, tray, IPC, Settings, idle sleep, updates glue); `startApp(platform)`
- `../shared/src/platform.ts` — `PlatformAdapter`: the only place OS differences enter (autostart, tray icon, window level, defaults, updatability)
- `../shared/renderer/` — companion window + Settings pages (loaded from inside the shared package; not copied)
- `src/platform-windows.ts` — Windows adapter (AppUserModelID, tray icon, `Control+Alt+Shift` defaults, installed-only updates); `src/autostart.ts` + `src/startup-entry.ts` — Run key via `app.setLoginItemSettings`, read via `reg.exe`; `src/windows-identity.ts` — `AUTOSTART_NAME` (must equal the value name in `installer.nsh`), portable detection
- New features go into `shared/` unless they're genuinely OS-specific; then extend `PlatformAdapter` rather than branching on `process.platform` in shared code

## Conventions

- The build reads only `../shared` and this folder: `src/`, `resources/assets/` (copied into `dist/assets`), `resources/build/` (electron-builder: `icon.ico`, `installer.nsh`). `.gitignore` entries are root-anchored (`/build/`, …) so `resources/build/` stays tracked
- Identity constants: `APP_ID` / `PRODUCT_NAME` in `shared/src/app-identity.ts` (`APP_ID` must equal `build.appId`)
- Start with Windows: Windows is the source of truth after the first launch. Saved as `startWithWindows` in `companions.json` (means "start at login" on every OS; name kept for compatibility)
- Updates (`shared/src/updater.ts`, `electron-updater` pinned exactly in `shared/package.json`): manual only, generic feed = GitHub release tag `desktop-latest` (`build.publish`); a Windows release needs `latest.yml`, the Setup `.exe` and its `.blockmap`. Installed app only (not portable/dev). Don't add background checks without asking
- Machine-level settings (`MACHINE_SETTINGS` in `companion-manager.ts`: shortcuts, Start with Windows, first-run flag, idle sleep) are never changed by loading a layout or importing a world file; add new per-PC preferences there. Platform defaults (e.g. shortcuts) come from `PlatformAdapter.defaults`
- Code signing: none configured. electron-builder signs when `CSC_LINK`/`CSC_KEY_PASSWORD` (or Azure Trusted Signing options) are provided; never commit certificates or secrets
- Keep Electron security defaults: `contextIsolation`, `sandbox`, no `nodeIntegration`, CSP in the HTML files, navigation/window-open blocked; validate every IPC input in the main process
- `companions.json` must stay backward compatible: new fields optional, filled in by `normalize*` in `companion-manager.ts`
- User-facing changes: update `README.md` and `CHANGELOG.md` `[Unreleased]` in the same change (and the other platforms' READMEs when the change is in `shared/`)
