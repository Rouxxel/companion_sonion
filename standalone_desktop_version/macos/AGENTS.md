# Agent notes — Sonion Companion (macOS desktop app)

`standalone_desktop_version/` is an npm workspace (`shared/` core + `windows/` + `macos/`, one `package-lock.json` at the root). Install at the workspace root; run app commands from `standalone_desktop_version/macos`.

## Verify

- `npm install` / `npm test` at the workspace root (unit tests run on any OS)
- `npm run typecheck` (in `macos/`) — builds the shared core and type-checks the macOS code; works on Windows too
- `npm start`, `npm run package:dir`, `npm run package`, `npm run package:signed` — **need macOS** (electron-builder can't build macOS targets on Windows/Linux)
  - `package` / `package:dir`: ad-hoc signed (`-c.mac.identity=-`), notarization off — for development and CI dev builds
  - `package:signed`: `scripts/check-signing-env.mjs` first (fails without a Developer ID identity source and a complete notarization credential set), then `electron-builder --mac -c.forceCodeSigning=true`; notarization runs automatically because the credentials are in the environment (`mac.notarize: true`)
  - `npm run verify:signature -- "<app>" [--release]`: codesign (+ `spctl`, `stapler`, Developer ID authority with `--release`)
- No local Mac: GitHub Actions workflow **Desktop macOS** (`.github/workflows/desktop-macos.yml`, manual). Default job `dev`: tests, ad-hoc universal `.dmg`, smoke test (install from the `.dmg`, launch, single instance, Open at Login first run, uninstall), screenshots. Input `signed`: job `signed` builds/signs/notarizes the universal app with the repository secrets `MACOS_CERTIFICATE_P12_BASE64`, `MACOS_CERTIFICATE_PASSWORD`, `APPLE_API_KEY_P8`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER` and verifies with `--release`

## Where code lives

- Shared behavior: `../shared/src/app.ts` (+ `platform.ts` interface). OS differences only through `PlatformAdapter`; don't branch on `process.platform` in shared code
- `src/platform-macos.ts`: **Dock icon shown** (no `LSUIElement`; owner decision) with a Dock menu (Add Companion, Settings…) and the bundle icon (`app.dock.setIcon` only in source runs), template tray icon, application menu (Edit role is required for ⌘C/⌘V in text fields), `activate` (Dock click, reopen) → Settings, `focusApp` (`app.focus({ steal: true })`), `applyAlwaysOnTop` (level `"floating"`; `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })` **once per window** — with a Dock icon Electron switches the process type for it and the Dock icon blinks, so never call it on every refresh), ⌘⌥⇧ shortcut defaults
- Architecture: **universal** only (`mac.target` arch `universal`; output `release/mac-universal/`, artifacts `SonionCompanion-<version>-universal.{dmg,zip}`). `verify-signature.sh` checks both slices with `lipo` and that `LSUIElement` is absent
- Resources are generated once and committed (no generator tooling): `trayTemplate.png` 16 px + `@2x` 32 px, pure black + alpha; `icon.png` 1024 px on Apple's grid (824 px tile)

## Conventions

- Keep dev dependency versions identical to `windows/` and `shared/` (pinned exactly)
- Bundle id = `APP_ID` (`com.sonion.companion`); data in `~/Library/Application Support/Sonion Companion`
- Open at Login (`src/login-item.ts`): only for the packaged app in /Applications; first-run default on (`autostartInitialized`), macOS is the source of truth afterwards; `requires-approval` counts as on with a Settings note. State logic is pure in `login-item-state.ts` (unit tests run on any OS: `npm test` in `macos/`)
- Move to Applications (`src/move-to-applications.ts`): prompt after ready when packaged outside /Applications; "Don't Ask Again" lives in `macos-preferences.json` (macOS-only, not in `companions.json`)
- `SONION_MAC_PANEL=1` switches companion windows to `type: "panel"` (evaluation only; via `PlatformAdapter.companionWindowOptions`)
- Updates: shared `updater.ts`; generic feed `desktop-latest` (`build.publish`), channel file `latest-mac.yml` (lists the universal `-mac.zip`). `updatesAvailable` = packaged + in /Applications + Developer ID–signed (`src/code-signature.ts`, parsed from `codesign --display` stderr), because Squirrel.Mac refuses ad-hoc apps. Manual checks only
- Publishing: CI `publish` job (inputs signed + publish, environment `desktop-release` with required reviewers) uploads with `gh release upload --clobber` and deletes only older macOS assets (`SonionCompanion-*-mac.zip`, `*.dmg`, their blockmaps). Never touch `latest.yml` / Windows or Linux files from the macOS workflow
- Smoke test: `scripts/smoke-macos.sh <dmg> [--release]` (CI runs it in both jobs); it moves the data folder aside and restores it, removes the app at the end, `FORCE=1` to replace an existing install
- Never commit certificates, Apple IDs, app-specific passwords or API keys (signing/notarization come via CI secrets); never echo them in scripts or workflow logs
- Hardened runtime is on with `resources/build/entitlements.mac.plist` (allow-jit, allow-unsigned-executable-memory, disable-library-validation — the last one is required for ad-hoc builds). Don't add entitlements without a reason; notarization rejects some
- The `.dmg` itself isn't signed or stapled; the app inside is (Gatekeeper checks the app). Verify the `.app`, not the `.dmg`
- `ELECTRON_RUN_AS_NODE=1` in the environment makes Electron start as plain Node (`app` undefined) — unset it
- User-facing changes: update `README.md` and `CHANGELOG.md` `[Unreleased]` in the same change; shared changes also go into `../windows/README.md` / `CHANGELOG.md`
- Releasing: same `version` in `windows/` and `macos/` for builds from the same commit; rename `[Unreleased]` to `[x.y.z] - YYYY-MM-DD` in each platform's CHANGELOG when its files are published to `desktop-latest`
