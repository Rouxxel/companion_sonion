# Agent notes — Sonion Companion (macOS desktop app)

`standalone_desktop_version/` is an npm workspace (`shared/` core + `windows/` + `macos/`, one `package-lock.json` at the root). Install at the workspace root; run app commands from `standalone_desktop_version/macos`.

## Verify

- `npm install` / `npm test` at the workspace root (unit tests run on any OS)
- `npm run typecheck` (in `macos/`) — builds the shared core and type-checks the macOS code; works on Windows too
- `npm start`, `npm run package:dir`, `npm run package` — **need macOS** (electron-builder can't build macOS targets on Windows/Linux)
- No local Mac: run the GitHub Actions workflow **Desktop macOS (dev build)** (`.github/workflows/desktop-macos.yml`, manual). It runs the tests, builds an ad-hoc-signed arm64 app, launches it, checks that opening it again keeps one main process, and uploads screenshots + the zipped app

## Where code lives

- Shared behavior: `../shared/src/app.ts` (+ `platform.ts` interface). OS differences only through `PlatformAdapter`; don't branch on `process.platform` in shared code
- `src/platform-macos.ts`: template tray icon, `app.dock.hide()` in source runs (packaged: `LSUIElement` in `build.mac.extendInfo`), application menu (Edit role is required for ⌘C/⌘V in text fields), `activate` → Settings, `focusApp` (`app.focus({ steal: true })`), `applyAlwaysOnTop` (`setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })` + level `"floating"`), ⌘⌥⇧ shortcut defaults
- Resources are generated once and committed (no generator tooling): `trayTemplate.png` 16 px + `@2x` 32 px, pure black + alpha; `icon.png` 1024 px on Apple's grid (824 px tile)

## Conventions

- Keep dev dependency versions identical to `windows/` and `shared/` (pinned exactly)
- Bundle id = `APP_ID` (`com.sonion.companion`); data in `~/Library/Application Support/Sonion Companion`
- "Open at Login" and updates are not implemented yet (adapter returns unavailable)
- Never commit certificates, Apple IDs, app-specific passwords or API keys (signing/notarization come via CI secrets)
- `ELECTRON_RUN_AS_NODE=1` in the environment makes Electron start as plain Node (`app` undefined) — unset it
- User-facing changes: update `README.md` and `CHANGELOG.md` `[Unreleased]` in the same change
