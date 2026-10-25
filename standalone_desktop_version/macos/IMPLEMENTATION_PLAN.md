# Sonion Companion (macOS desktop) — Implementation plan

This plan brings the Sonion Companion desktop app to **macOS** as a normal, signed and notarized Mac app: delivered as a **`.dmg`** (drag to Applications), living in the **menu bar**, with transparent always-on-top companions that float over other apps (including full-screen Spaces), an optional **login item**, and **manual updates**. Features and behavior match the Windows app in `standalone_desktop_version/windows`. The platform-neutral code moves into a **shared core package** used by all desktop apps.

**Last updated:** 2026-10-25 (owner decisions recorded: macOS desktop app in this folder, shared core package, Developer ID + notarization; folder renamed to `macos/`; Phase 0 (shared core) and Phase 1 (code + CI dev build) implemented, Phase 1 Mac verification pending; Phases 2–5 not started)
**Target release:** first macOS release with the same version as the Windows release built from the same commit (proposed `0.3.0`)
**Folder:** `standalone_desktop_version/macos` (renamed from `ios` on 2026-10-25, §6 #1)

| Document | Path |
| -------- | ---- |
| Windows app (reference implementation, feature source) | `standalone_desktop_version/windows/` (`README.md`, `src/`, `package.json`) |
| Shared core package (to create, Phase 0) | `standalone_desktop_version/shared/` |
| Workspace root (to create, Phase 0) | `standalone_desktop_version/package.json` |
| macOS app (to create, Phase 1+) | `standalone_desktop_version/macos/` (`package.json`, `src/`, `resources/`, `scripts/`, `README.md`, `CHANGELOG.md`, `AGENTS.md`) |
| CI build + notarization (to create, Phase 4) | `.github/workflows/desktop-macos.yml` |

### Starting point: what exists today

- `standalone_desktop_version/macos/` is **empty** (not tracked by git).
- The **Windows app** is complete and verified (Electron 43.7.9, electron-builder 26.15.3, electron-updater 6.8.10, TypeScript 5.9, Node 22): companions, tray, Settings, layouts, multi-monitor placement, hover and per-companion opacity, dozing, export/import, single instance, Start with Windows, manual updates from the GitHub release `desktop-latest`, 37 unit tests, installer smoke script.
- Almost all of its code is **platform-neutral Electron/TypeScript**. Windows-only parts are small and isolated:

| Windows-only piece | Where | macOS equivalent |
| ------------------ | ----- | ---------------- |
| `app.setAppUserModelId` (taskbar grouping) | `src/main.ts` | Not needed (bundle id groups windows) |
| Start with Windows via Run key, read with `reg.exe` | `src/autostart.ts`, `src/startup-entry.ts` | `app.setLoginItemSettings` / `getLoginItemSettings` (SMAppService on macOS 13+, incl. `requires-approval`) |
| Portable detection (`PORTABLE_EXECUTABLE_FILE`) | `src/app-identity.ts` | Not applicable; instead "running outside /Applications" (`app.isInApplicationsFolder()`) |
| Tray icon: colored tile PNG resized to 16 px | `src/main.ts` | Menu-bar **template image** (`trayTemplate.png` + `@2x`, black + alpha) |
| Updater limited to `win32` | `src/updater.ts` | `MacUpdater` (Squirrel.Mac) — needs a **signed** app and a **zip** artifact |
| NSIS installer + `installer.nsh`, `.ico` | `package.json`, `resources/build/` | `.dmg` + `.zip`, `.icns` (from a 1024 px PNG), hardened runtime, notarization |
| No application menu | `src/main.ts` | macOS needs an app menu with an **Edit** menu, otherwise ⌘C/⌘V/⌘A don't work in Settings and the URL dialog |
| Shortcut defaults `Control+Alt+Shift+A/S` | `src/companion-manager.ts` | Platform defaults (§4.4) |

The renderer already accepts ⌘ for its ⌘O / ⌘U shortcuts (`event.ctrlKey || event.metaKey`).

### Delivery tracks

| Track | Phases | Outcome |
| ----- | ------ | ------- |
| **T-A — Shared core** | 0 | Platform-neutral code in `standalone_desktop_version/shared`, consumed by the Windows app with **no behavior change** (Windows tests + installer smoke still pass) |
| **T-B — Runs on a Mac** | 1 | `npm start` in `macos/` shows companions, menu-bar icon, Settings; Mac-correct windows (Spaces, full screen, no Dock icon) |
| **T-C — Mac citizen** | 2 | Login item, app menu, "Move to Applications", single instance via `activate`, platform shortcut defaults, uninstall/data story |
| **T-D — Package, sign, notarize** | 3 | Signed + notarized `.dmg` and `.zip` for arm64 and x64; Gatekeeper accepts them |
| **T-E — CI, updates, smoke** | 4 | GitHub Actions macOS build with secrets; `latest-mac.yml` in `desktop-latest`; scripted smoke test on the runner |
| **T-F — Release** | 5 | README / CHANGELOG / AGENTS.md, first macOS release, owner checklist on a real Mac |
| **T-DOC** | every phase | Docs updated in the same change (§0.2) |

**Start order:** 0 → 1 → 2 → 3 → 4 → 5. Phase 0 is shared with the Linux app; if `standalone_desktop_version/shared` already exists, verify it against Phase 0's exit criterion and continue with Phase 1.

**Hard constraint:** signing and notarization **require macOS** (Xcode command-line tools). The development PC is Windows, so builds that are signed or tested on macOS run on **GitHub Actions macOS runners**. Hands-on checks need **a Mac** (§6 #2).

---

## 0. Product contract (enforce in code)

| Requirement | System obligation |
| ----------- | ----------------- |
| **Same product as on Windows** | Same features, settings, data model (`companions.json` schema), export/import format, defaults (except shortcuts, §4.4) |
| **Installs like a Mac app** | `.dmg` with the app and an Applications shortcut; runs from `/Applications`; offers to move itself there when started elsewhere |
| **No Gatekeeper warnings** | Developer ID–signed, hardened runtime, notarized and stapled; `spctl --assess` accepts the app and the `.dmg` |
| **Menu-bar app** | Menu-bar icon (template image, adapts to light/dark menu bar); no Dock icon by default (§6 #3); companions never appear in ⌘-Tab |
| **Floats properly** | Companions stay above normal windows, appear on **all Spaces** and over **full-screen apps**, don't steal focus when shown |
| **One instance** | Opening the app again (Finder, Launchpad, Spotlight) shows Settings of the running app |
| **Login item** | On by default for the app in `/Applications` (first launch), respects being turned off (app or System Settings → General → Login Items), surfaces "needs approval" |
| **Updates** | Manual "Check for Updates…" only; verifies the download; same `desktop-latest` release as Windows (`latest-mac.yml`) |
| **Keeps user data safe** | Data in `~/Library/Application Support/Sonion Companion`; never deleted without explicit confirmation |
| **Doesn't break Windows** | The shared-core refactor keeps Windows behavior and tests identical |

### 0.1 Single-source-of-truth rules

1. **One implementation per feature** in `shared/`; platform folders only contain the platform adapter (§2), packaging config, resources, scripts and docs.
2. **Identity constants** (`APP_ID = com.sonion.companion`, `PRODUCT_NAME = Sonion Companion`) live in the shared core; the macOS bundle id equals `APP_ID`.
3. **Data model changes** happen in the shared core with tests, stay backward compatible (`CONFIG_VERSION` stays `1`), and are documented in every platform README they affect.
4. **Secrets** (certificates, Apple ID passwords, API keys) only in CI secrets / local environment variables; never committed.

### 0.2 Documentation policy

Every phase updates, in the same change: `macos/README.md` (user-facing), `macos/CHANGELOG.md` `[Unreleased]`, `macos/AGENTS.md` (build/test/sign notes), this plan; plus `windows/README.md` / `windows/AGENTS.md` when shared code or the Windows build process changes (Phase 0).

---

## 1. Scope

### 1.1 In scope

- Shared core extraction (Phase 0) with Windows regression checks.
- macOS app for **Apple silicon (arm64) and Intel (x64)**, minimum macOS version as supported by Electron 43 (macOS 12 Monterey or later; confirm in Phase 1).
- All Windows features: companions (drag, wheel resize, aspect ratio, lock, assets local/URL/cached, per-companion opacity), hover opacity, dozing (`powerMonitor`), layouts, export/import, multi-monitor placement, Settings, global shortcuts with status, single instance, login item, manual updates.
- macOS-specific: menu-bar template icon, no Dock icon (default), app/Edit menu, all Spaces + full screen, Move to Applications, login-item approval state, signing + notarization, `.dmg` + `.zip`.
- CI build on GitHub Actions (macOS runner) with signing/notarization secrets; smoke script on the runner.

### 1.2 Out of scope

- iPhone/iPad (iOS) — overlay windows over other apps aren't possible there.
- Mac App Store distribution (sandboxing conflicts with global shortcuts/login item handling; different signing).
- Automatic background update checks (Windows decision applies: manual only).
- Universal binary (two smaller arch-specific builds instead; §6 #4).

---

## 2. Architecture (target)

```
standalone_desktop_version/
├── package.json              # npm workspaces: ["shared", "windows", "macos", "linux"]
├── shared/                   # @sonion/companion-core (TypeScript → dist/, CommonJS + .d.ts)
│   ├── src/
│   │   ├── app.ts            # startApp(platform): windows, tray menu model, IPC, settings, idle sleep, updates glue
│   │   ├── platform.ts       # PlatformAdapter interface (below)
│   │   ├── companion-manager.ts, geometry.ts, app-identity.ts, updater.ts, preload.ts
│   │   └── test/             # node:test unit tests (moved from windows/src/test, platform-neutral)
│   └── renderer/             # companion-window.*, settings.* (HTML/CSS/JS), copied by each app
├── windows/                  # platform-windows.ts (AUMID, Run key autostart, reg.exe), NSIS config, smoke-install.ps1
├── macos/                      # macOS: platform-macos.ts, dmg/zip/notarize config, entitlements, smoke-macos.sh
└── linux/                    # (Linux app)
```

**PlatformAdapter** (implemented once per OS, passed to `startApp`):

```ts
export interface PlatformAdapter {
  id: "win32" | "darwin" | "linux";
  /** Before app "ready": command-line switches, AUMID, etc. */
  beforeReady(): void;
  /** After "ready": Dock/menu bar/app menu setup. */
  afterReady(ctx: AppContext): void;
  defaultShortcuts: ShortcutSettings;
  trayIcon(): Electron.NativeImage;
  /** Extra BrowserWindow options / calls for companion windows (always-on-top level, Spaces). */
  decorateCompanionWindow(window: Electron.BrowserWindow): void;
  autostart: {
    available(): boolean;
    isEnabled(): boolean;
    setEnabled(enabled: boolean): boolean;
    /** Status text for Settings, e.g. "Needs approval in System Settings → General → Login Items". */
    note(): string | undefined;
    /** First-run default (installed builds only). */
    initialize(manager: CompanionManager): void;
  };
  updatesAvailable(): boolean;
  /** "Open the app again" hook: second-instance on Windows/Linux, `activate` on macOS. */
  onReopen(handler: () => void): void;
}
```

**Package consumption:** npm workspaces; `@sonion/companion-core` is a regular dependency of each app (`"@sonion/companion-core": "*"`), built before the app (`npm run build -w shared`). electron-builder must package it into `app.asar` (`node_modules/@sonion/companion-core/dist/**`); verified in Phase 0. Fallback if electron-builder mishandles the workspace symlink: compile shared sources into each app's `dist/` via TypeScript project references (no new dependencies) — §8.

---

## 3. Baseline facts (verified 2026-10-24)

- Development PC: Windows, Node 22.15.0, npm 11.6.2, Docker Desktop (no Mac, no WSL Linux distro).
- GitHub repo `Rouxxel/companion_sonion`: **no releases yet**; the Windows updater feed is `https://github.com/Rouxxel/companion_sonion/releases/download/desktop-latest` (generic provider).
- Windows app sizes: `main.ts` 535 lines (mostly platform-neutral), `companion-manager.ts` 415, `geometry.ts` 82, renderer ~580 lines; tests 37 (`npm test`).

### 3.1 Evidence commands

```bash
# Phase 0 (Windows PC): Windows app still fine after the shared-core move
cd standalone_desktop_version && npm ci && npm test --workspaces --if-present
cd windows && npm run package && npm run test:install

# Phase 1+ (Mac or CI macOS runner)
cd standalone_desktop_version/macos && npm start
npm run package                          # dmg + zip in release/
codesign --verify --deep --strict --verbose=2 "release/mac-arm64/Sonion Companion.app"
spctl --assess --type execute --verbose "release/mac-arm64/Sonion Companion.app"
xcrun stapler validate release/SonionCompanion-*-arm64.dmg
```

---

## 4. Contracts

### 4.1 Resources (tracked, `macos/resources/`)

```
resources/
  assets/sonion.jpeg            # default companion (same as Windows)
  assets/trayTemplate.png       # 16×16 black + alpha (the original transparent line-art handshake)
  assets/trayTemplate@2x.png    # 32×32
  build/icon.png                # 1024×1024, macOS-style padding (~10 %), white rounded tile like Windows
  build/entitlements.mac.plist  # hardened runtime entitlements Electron needs
```

The template image uses the original transparent black line art (it was unsuitable for the Windows dark taskbar, but is exactly what a macOS template image needs). electron-builder converts `icon.png` to `.icns`.

### 4.2 `macos/package.json` (target excerpt)

```jsonc
{
  "name": "companion-sonion-macos",
  "version": "0.3.0",
  "main": "dist/main.js",
  "dependencies": { "@sonion/companion-core": "*", "electron-updater": "6.8.10" },
  "build": {
    "appId": "com.sonion.companion",
    "productName": "Sonion Companion",
    "directories": { "output": "release", "buildResources": "resources/build" },
    "mac": {
      "category": "public.app-category.entertainment",
      "target": [{ "target": "dmg", "arch": ["arm64", "x64"] }, { "target": "zip", "arch": ["arm64", "x64"] }],
      "hardenedRuntime": true,
      "entitlements": "resources/build/entitlements.mac.plist",
      "entitlementsInherit": "resources/build/entitlements.mac.plist",
      "notarize": true,
      "extendInfo": { "LSUIElement": true }
    },
    "dmg": { "artifactName": "SonionCompanion-${version}-${arch}.${ext}" },
    "zip": { "artifactName": "SonionCompanion-${version}-${arch}-mac.${ext}" },
    "publish": [{ "provider": "generic", "url": "https://github.com/Rouxxel/companion_sonion/releases/download/desktop-latest" }]
  }
}
```

Notarization credentials come from the environment (`APPLE_API_KEY`/`APPLE_API_KEY_ID`/`APPLE_API_ISSUER` preferred, or `APPLE_ID`/`APPLE_APP_SPECIFIC_PASSWORD`/`APPLE_TEAM_ID`); the signing certificate from `CSC_LINK`/`CSC_KEY_PASSWORD` (Developer ID Application, `.p12`).

### 4.3 Window behavior (macOS adapter)

| Aspect | Setting |
| ------ | ------- |
| Always on top | `setAlwaysOnTop(true, "floating")` when the setting is on |
| Spaces / full screen | `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })` |
| Focus | Evaluate `type: "panel"` (non-activating) for companion windows; keep clicks/drag/wheel/menu/keyboard working; fall back to normal windows if keyboard shortcuts break |
| ⌘-Tab / Dock | `LSUIElement` (no Dock icon, not in ⌘-Tab); Settings is brought to front with `app.focus({ steal: true })` |
| Reopen | `app.on("activate")` → Settings (macOS delivers re-launches as `activate`, not `second-instance`); keep the single-instance lock for `open -n` |
| Quit | ⌘Q in Settings and "Quit" in the menu-bar menu; closing the last window doesn't quit |

### 4.4 Shortcut defaults per platform

| Platform | Add companion | Open Settings |
| -------- | ------------- | ------------- |
| Windows / Linux | `Control+Alt+Shift+A` | `Control+Alt+Shift+S` |
| macOS | `Command+Alt+Shift+A` (⌘⌥⇧A) | `Command+Alt+Shift+S` (⌘⌥⇧S) |

Implemented as `PlatformAdapter.defaultShortcuts`, passed to `CompanionManager` as the normalization default. Shortcuts stay machine-level settings (never imported/exported), so world files move between OSes cleanly.

### 4.5 Login item rules (mirror of Windows "Start with Windows")

- First launch of the app **from `/Applications`** → `setLoginItemSettings({ openAtLogin: true })`, record `autostartInitialized`.
- Afterwards macOS is the source of truth: `getLoginItemSettings().openAtLogin` / `status`. `requires-approval` → Settings shows "Approve in System Settings → General → Login Items"; never re-enable after the user turns it off.
- Running elsewhere (DMG, Downloads, dev) → no automatic login item; the first launch outside `/Applications` offers **Move to Applications** (`app.moveToApplicationsFolder()`).
- Launched at login → `getLoginItemSettings().wasOpenedAtLogin` (or launch args) → don't open Settings.

### 4.6 Uninstall and data

- Uninstall = drag the app to the Trash. macOS removes its login item registration when the app is gone (verify; document if a stale entry remains).
- Data stays in `~/Library/Application Support/Sonion Companion`. Settings gets **Delete all data…** (shared feature: confirm → quit → delete folder), useful on every platform where uninstall can't ask (macOS, Linux).

---

## 5. Phased delivery

### Phase 0 — Shared core package (skip if `standalone_desktop_version/shared` already exists and passes this exit criterion)

**Tasks**
- [x] `standalone_desktop_version/package.json` with npm workspaces `["shared", "windows", "macos", "linux"]` (only folders with a `package.json` count); single lockfile at the workspace root.
  - **npm rejects workspace entries without a `package.json`**, so the list is `["shared", "windows"]`; add `macos`/`linux` when they get one (Phase 1).
  - The lockfile was seeded from `windows/package-lock.json` (since removed): **0 changed, 0 new resolved versions**.
  - Dev dependencies are pinned exactly to the verified versions (electron 43.7.9, electron-builder 26.15.3, typescript 5.9.3, @types/node 22.20.1).
  - Root scripts: `build`, `test`, `typecheck` across workspaces.
  - `windows/node_modules` was removed (dependencies are now hoisted to the root); the Electron binary needed `node node_modules/electron/install.js` again.
- [x] Create `shared/` (`@sonion/companion-core`, private): move `companion-manager.ts`, `geometry.ts`, `updater.ts`, `preload.ts`, the platform-neutral parts of `app-identity.ts` and `main.ts` (→ `app.ts` exporting `startApp(platform)`), the renderer files and the platform-neutral tests.
  - `index.ts` re-exports the public API. `electron-updater` is now a dependency of the shared package.
  - Build: `tsconfig.json` → `dist/` (with `.d.ts`, tests excluded); tests: `tsconfig.test.json` → `build-test/`. Both build scripts clean their output first: a stale `windows/dist/test` had briefly double-counted old tests.
  - `app.ts` is `main.ts` with the startup code moved into `startApp(platform)`. Behavior is unchanged; strings that named Windows ("Start with Windows" in the import dialog, tray) now use the platform's label.
- [x] Define `PlatformAdapter` (§2); move Windows specifics into `windows/src/platform-windows.ts` (AUMID, Run-key autostart incl. `startup-entry.ts` and its tests, portable detection, tray icon, `Control+Alt+Shift` defaults, `updatesAvailable` = installed only).
  - **Interface as implemented** (`shared/src/platform.ts`) differs from the §2 sketch:
    - added `assetsDir`, `devWindowIcon`, `launchedAtLogin()`, and `autostart.label` (used by the tray and Settings)
    - `applyAlwaysOnTop(window, on)` replaces `decorateCompanionWindow`; it is called wherever "keep on top" is applied, which is where macOS sets its window level and Spaces behavior
    - no `onReopen`: the shared app always handles `second-instance`, and macOS adds its `activate` handler in `afterReady(ctx)`, which receives `showSettings`/`addCompanion`
  - The Windows-only identity (`AUTOSTART_NAME`, portable detection) is in `windows/src/windows-identity.ts`.
  - `updater.ts` takes `available` from the adapter instead of checking `win32` itself.
  - `app:get-info` returns `autostart { label, available, note }` and `platform`. The Settings page shows the platform's label and note, so macOS can say "Open at Login".
- [x] `CompanionManager` accepts default shortcuts from the platform (constructor option); keep all existing tests green. (`new CompanionManager(dir, { defaults: { shortcuts, idleSleep } })`; the old `fileName` argument moved into the options; defaults are threaded through all normalization, including layouts and world import. 2 new tests.)
- [x] Windows `copy-static.mjs` copies `shared/renderer` + `resources/assets`; `windows/src/main.ts` becomes `startApp(windowsPlatform)`. (**Changed:** the renderer pages and the preload script are loaded from inside the shared package, `node_modules/@sonion/companion-core/{renderer,dist}`, so apps don't copy them. `copy-static.mjs` only copies `resources/assets`. `main.ts` is 4 lines.)
- [x] Verify electron-builder packages the workspace dependency (`asar list` shows `node_modules/@sonion/companion-core/dist/...`), or switch to the project-references fallback (§8). (**Works with workspaces, no fallback needed.** `app.asar` contains `@sonion/companion-core/dist/*.js`, `renderer/*`, `package.json` and `electron-updater`; no `src/`, `build-test/` or `dist/test`. Excluded via a `build.files` pattern.)

**Docs gate:** `windows/AGENTS.md` (workspace commands, where code lives), `windows/README.md` Development (install from the workspace root), this plan. — **Done** (`AGENTS.md` rewritten: workspace, verify commands incl. an asar check, where code lives, "extend `PlatformAdapter` instead of branching on `process.platform`"; README Development/Build/Project layout updated). The Windows CHANGELOG is unchanged: no user-facing change.

**Exit criterion:** from a clean clone on the Windows PC: `npm ci` at `standalone_desktop_version/`, shared + Windows unit tests pass (≥ 37), `windows/` `npm run package` builds the installer, `npm run test:install` **24/24 PASS**, the app behaves as before (manual spot check: tray, Settings, drag, dozing). — **Met in this working copy** (2026-10-25):
  - `npm install` at the workspace root; `npm test` **39/39** (shared 32, Windows 7).
  - Source run: companion window shown; a second launch exits with code 0 and opens exactly one Settings window; the Settings screenshot shows the platform label "Start with Windows" and its note.
  - Packaged out of tree (Controlled folder access), asar verified, `npm run test:install` **24/24 PASS** (includes first-launch autostart through the adapter, single instance and update), machine left clean, `companions.json` restored.
  - **Not done:** a literal fresh clone with `npm ci`. **Owner, quick manual spot check:** drag, opacity slider, dozing.

### Phase 1 — Runs on a Mac (development build)

**Tasks**
- [x] *(decision §6 #1)* Folder renamed `ios/` → `macos/` (owner OK); references in this plan and the Linux plan updated.
- [x] `macos/package.json`, `tsconfig.json`, `scripts/copy-static.mjs` (copies `shared/renderer` + `macos/resources/assets`), `src/main.ts` → `startApp(macPlatform)`.
  - The renderer is loaded from the shared package (Phase 0), so `copy-static.mjs` only copies `resources/assets`.
  - `package.json`: name `sonion-companion-macos`, version `0.2.0` (same as Windows, §6 #6); dev dependencies pinned identically; electron-builder `mac` config with `dmg` + `zip` (arm64, x64), `LSUIElement`, icon, artifact names. Signing/notarization keys come in Phase 3.
  - `macos` added to the workspace (`npm install`: +1 workspace link, no new packages).
- [x] `src/platform-macos.ts`: template tray icon (`nativeImage` from `trayTemplate.png`, `setTemplateImage(true)`), window decoration per §4.3, `activate` → Settings, `LSUIElement` behavior in dev (`app.dock.hide()` when not packaged), app menu with standard roles (`appMenu`, `editMenu`, `windowMenu`).
  - **App menu:** custom app menu (About, Settings… ⌘,, Add Companion, Hide/Hide Others/Show All, Quit) + `editMenu` + `windowMenu`.
  - **New shared hook `focusApp`:** called by `showSettings`; on macOS it runs `app.focus({ steal: true })`, so Settings comes to the front even without a Dock icon.
  - **Windows:** `applyAlwaysOnTop` sets `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })` always, plus level `"floating"` when "keep on top" is on.
  - **Deferred:** `type: "panel"`. It's a window-creation option and needs testing on a real Mac; evaluate in Phase 2 together with keyboard input.
  - "Open at Login" is a stub (unavailable, note "Not available yet in this version") until Phase 2; updates are unavailable until Phase 4.
- [x] Resources per §4.1 (generate the template PNGs and the 1024 px icon once; commit results, not a generator).
  - `trayTemplate.png` 16 px and `@2x` 32 px are the original line art recolored to pure black + alpha.
  - `icon.png` 1024 px: white 824 px rounded tile (radius 185) with a soft shadow, artwork at 70 %.
  - Previewed on light and dark menu bars and at 170/64/32 px. Generated once with System.Drawing; no tooling committed.
  - The `entitlements.mac.plist` from §4.1 belongs to Phase 3 (hardened runtime).
- [x] Confirm the minimum macOS version supported by Electron 43 and record it in the README. (**macOS 12 Monterey**: Electron 38 dropped macOS 11, Electron 44 drops macOS 12. Recorded in the README.)
- [x] Check every renderer shortcut and label for ⌘ wording on macOS (menu labels, Settings hints: show ⌘⌥⇧A instead of Control+Alt+Shift+A).
  - Settings now shows the example "Command+Alt+Shift+A (⌘⌥⇧A)" and ⌘ placeholders when `app:get-info` reports `darwin`. The renderer already accepted ⌘O/⌘U.
  - **Found:** Mac keyboards' "delete" key sends Backspace, so the Delete shortcut (remove companion) didn't work. **⌘⌫** now also removes the companion, on all platforms.
- [x] *(added)* `.github/workflows/desktop-macos.yml` (**manual** `workflow_dispatch`, `macos-14`), so this phase can be checked without a Mac:
  - `npm ci` + all unit tests
  - builds an unpacked arm64 app, ad-hoc signs it and verifies the signature
  - asserts `LSUIElement`
  - launches it and takes a screenshot; opens it again and takes a second screenshot; asserts **one** main process
  - lists the data folder
  - uploads the screenshots + `SonionCompanion-dev-arm64.zip`
  - The YAML was validated locally. Phase 4 extends this workflow (signing, notarization, `latest-mac.yml`).

**Docs gate:** `macos/README.md` (Run from source, requirements), `macos/AGENTS.md` (commands, ELECTRON_RUN_AS_NODE note), this plan. — **Done.** README: requirements, menu-bar behavior, CI dev build + how to open the unsigned app, ⌘ controls, data folder, development layout. AGENTS.md: what needs a Mac, the CI workflow, adapter details, conventions. New `CHANGELOG.md` `[Unreleased]`. Windows `AGENTS.md` lists `macos/`.

**Exit criterion (on a Mac or a macOS CI runner with a screenshot step):** `npm start` shows the default companion and the menu-bar icon (light and dark menu bar); drag, wheel resize, right-click menu, opacity slider, Settings with working ⌘C/⌘V in text fields; companions stay visible when switching Spaces and over a full-screen app; no Dock icon. — **Not verifiable on this Windows PC; everything up to that is in place** (2026-10-25):
  - On Windows: `npm run typecheck` is clean for shared, Windows and macOS; `npm test` **39/39**; the macOS `dist/` builds (main, adapter, assets); renderer syntax checked.
  - The Windows app is unaffected: a source run shows the companion, and a second launch opens one Settings window with no errors.
  - **Owner, next step:** push the branch and run **Desktop macOS (dev build)** from the Actions tab. It checks build, launch, single instance and `LSUIElement`, and gives screenshots of the companion, menu-bar icon and Settings.
  - **Owner, on a Mac (or with the zipped app):** drag, wheel resize, right-click menu, opacity slider, ⌘C/⌘V in Settings, Spaces / full-screen visibility, light/dark menu bar.

### Phase 2 — Mac citizen

**Tasks**
- [ ] Login item per §4.5 (`platform-macos.ts` autostart), including `requires-approval` note in Settings and no Settings window at login.
- [ ] Move to Applications prompt on first launch outside `/Applications` (once; "Don't ask again" stored as machine-level setting).
- [ ] Single instance: lock + `activate` → Settings; `open -n` second instance exits.
- [ ] Platform shortcut defaults (§4.4) and shortcut status in Settings (global shortcuts work without Accessibility permission; verify).
- [ ] Idle sleep via `powerMonitor.getSystemIdleTime()` (verify it reports real idle time on macOS 13+).
- [ ] **Delete all data…** in Settings (shared, all platforms) with confirmation; README uninstall section.

**Docs gate:** README (Install, Login item, Uninstall, Shortcuts, Troubleshooting), CHANGELOG, this plan.

**Exit criterion:** on a Mac: the packaged-but-unsigned app (`npm run package:dir`) in `/Applications` registers the login item on first launch, survives a logout/login without opening Settings, stays off after turning it off in System Settings; opening the app again shows Settings; ⌘⌥⇧A adds a companion from any app.

### Phase 3 — Package, sign, notarize

**Tasks**
- [ ] electron-builder config per §4.2: `dmg` + `zip`, arm64 + x64, hardened runtime, entitlements (start from electron-builder's defaults: `com.apple.security.cs.allow-jit`, `allow-unsigned-executable-memory`, `disable-library-validation` only if needed), `notarize: true`, `LSUIElement`.
- [ ] Owner: Apple Developer Program membership; create a **Developer ID Application** certificate (export `.p12`) and an **App Store Connect API key** (or app-specific password) for notarization.
- [ ] Unsigned fallback for contributors: `npm run package` without credentials builds an ad-hoc-signed app and skips notarization with a clear message.
- [ ] `package:dir` for quick checks.

**Docs gate:** README (Install from `.dmg`), `AGENTS.md` (required env vars, never commit secrets), this plan.

**Exit criterion:** `codesign --verify --deep --strict`, `spctl --assess --type execute` and `xcrun stapler validate` succeed for both architectures; opening the downloaded `.dmg` on a Mac shows no Gatekeeper warning.

### Phase 4 — CI, updates, smoke test

**Tasks**
- [ ] `.github/workflows/desktop-macos.yml`: on `workflow_dispatch` and tags `desktop-v*`; `macos-14` runner; `npm ci` at the workspace root; shared tests; `npm run package -w macos`; upload artifacts; secrets `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_API_KEY` (+ id, issuer) or Apple ID trio.
- [ ] Updates: `updatesAvailable()` = signed app in `/Applications`; `latest-mac.yml` + both `.zip` (+ `.blockmap`) uploaded to `desktop-latest` next to the Windows files; "Check for Updates…" in the menu-bar menu and Settings (shared code).
- [ ] `scripts/smoke-macos.sh` (runs on the CI runner): mount the `.dmg`, verify signature/notarization, copy the app to `/Applications`, launch, assert one process, second launch (`open -n`) exits, login item registered (`sfltool dumpbtm` via sudo on CI, optional), quit, remove the app; data folder untouched.
- [ ] Optional: release job that uploads to `desktop-latest` with `gh release upload --clobber` (only on tags, only with owner approval).

**Docs gate:** README "Publishing an update" (macOS files), `AGENTS.md` (CI, secrets), this plan.

**Exit criterion:** a tagged CI run produces signed + notarized artifacts and `latest-mac.yml`; smoke script passes on the runner; an older installed build finds and installs the newer one from `desktop-latest` (owner test on a Mac).

### Phase 5 — Docs & first macOS release

**Tasks**
- [ ] `macos/README.md` complete (mirrors the Windows README structure: Install, Run, Features, Controls with ⌘ keys, Settings, Data storage `~/Library/Application Support/Sonion Companion`, Moving to another PC, Troubleshooting incl. "app can't be opened", login item approval, Known limitations).
- [ ] `macos/CHANGELOG.md` first release entry; `macos/AGENTS.md`.
- [ ] Owner checklist (§9) on a real Mac (Apple silicon; Intel if available).

**Docs gate:** README, CHANGELOG, AGENTS.md, this plan.

**Exit criterion:** §9 success criteria met; artifacts published to `desktop-latest` by the owner.

---

## 6. Open decisions

| # | Topic | Options | Recommendation |
| - | ----- | ------- | -------------- |
| 1 | Folder name | Keep `ios/` / rename to `macos/` | **Decided 2026-10-25: renamed to `macos/`** (owner OK) |
| 2 | Mac for hands-on testing | Owner's Mac / borrowed Mac / CI screenshots only | A real Mac is needed for the §9 checklist; CI covers build, signing and smoke |
| 3 | Dock icon | Hidden (menu-bar app) / shown / setting | **Hidden by default** (like the tray-only Windows app), optional "Show in Dock" setting later |
| 4 | Architectures | arm64 + x64 separately / universal | **Separate** (half the download size); universal only if the updater needs it |
| 5 | Notarization credentials | App Store Connect API key / Apple ID + app-specific password | **API key** (no 2FA prompts in CI) |
| 6 | Version alignment | Same version across platforms / independent | **Same version per commit** (one CHANGELOG entry per platform, one `desktop-latest` release) |

## 7. Dependency matrix

| Phase | Depends on | Blocks |
| ----- | ---------- | ------ |
| 0 | — | 1–5 (and the Linux app) |
| 1 | 0 | 2, 3 |
| 2 | 1 | 5 |
| 3 | 1, Apple Developer account | 4 |
| 4 | 3, GitHub secrets | 5 |
| 5 | 2, 4, a Mac | — |

## 8. Risks and mitigations

| Risk | Mitigation |
| ---- | ---------- |
| electron-builder doesn't package the npm-workspace dependency correctly | Verify in Phase 0 with `asar list`; fallback: TypeScript project references compiling `shared/src` into each app's `dist/` (no runtime package resolution, no new dependencies) |
| Refactor changes Windows behavior | Phase 0 exit = Windows unit tests + installer smoke 24/24 + manual spot check |
| No local Mac | CI for build/sign/smoke; owner Mac for the checklist (§6 #2) |
| Notarization fails (entitlements, unsigned helper binaries) | Start from electron-builder defaults; read `notarytool log`; keep `hardenedRuntime` |
| `type: "panel"` breaks keyboard input in companion windows | Feature-flag it in the adapter; fall back to normal windows + `visibleOnFullScreen` |
| Login item `requires-approval` confuses users | Settings note with the exact System Settings path; README troubleshooting |
| Squirrel.Mac update fails for apps outside `/Applications` | `updatesAvailable()` only in `/Applications`; Move to Applications prompt |
| Global shortcut collisions on macOS | Platform defaults (⌘⌥⇧) + existing status display + editable shortcuts |
| Secrets leak | Only CI secrets / local env; `AGENTS.md` rule; no certificates in the repo |

## 9. Success criteria (macOS app delivered)

- [ ] Shared core in place; Windows tests and installer smoke unchanged (24/24).
- [ ] Signed, notarized, stapled `.dmg`/`.zip` for arm64 and x64; no Gatekeeper warning on a fresh Mac.
- [ ] Menu-bar icon (template), no Dock icon, Settings opens when reopening the app; one instance only.
- [ ] Companions float over other apps, on all Spaces and over full-screen apps, without stealing focus.
- [ ] Login item on by default from `/Applications`, stays off when turned off, approval state shown.
- [ ] ⌘C/⌘V work in Settings and the URL dialog; ⌘⌥⇧A/⌘⌥⇧S work from any app (status shown).
- [ ] Feature parity: layouts, export/import (files interchangeable with Windows), dozing, opacity, multi-monitor.
- [ ] Manual updates from `desktop-latest` work from an older installed build.
- [ ] README, CHANGELOG, AGENTS.md describe exactly what ships.

**Owner checklist on a real Mac:** install from `.dmg` (no warning) → first launch offers nothing unexpected, login item registered → menu-bar icon in light and dark menu bar → companions over a full-screen Safari window and on another Space → ⌘⌥⇧A from another app → Settings ⌘V into the shortcut field → log out/in (app starts, no Settings) → turn the login item off in System Settings, log out/in (stays off) → export on Windows, import on Mac → Check for Updates with a newer `desktop-latest` → drag app to Trash, data folder remains → Delete all data… removes it.

## 10. References

- Electron: `BrowserWindow` (`type: "panel"`, `setVisibleOnAllWorkspaces`, `setAlwaysOnTop` levels), `app.setLoginItemSettings` (macOS 13+ SMAppService, `status`), `app.moveToApplicationsFolder`, `nativeImage.setTemplateImage`, `powerMonitor.getSystemIdleTime`.
- electron-builder: macOS targets (`dmg`, `zip`), code signing (`CSC_LINK`), notarization (`mac.notarize`, Apple API key env vars), `extendInfo`.
- electron-updater: `MacUpdater` (requires signed app + zip), generic provider, `latest-mac.yml`.
- Apple: Developer ID, notarization (`notarytool`), hardened runtime, Login Items in System Settings.
