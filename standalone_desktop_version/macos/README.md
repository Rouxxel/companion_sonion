# Sonion Companion (macOS)

Floating desktop companions for macOS: transparent, frameless windows showing a PNG, JPEG, GIF, WebP, BMP, SVG or WebM asset that float above other apps, on every Space and over full-screen apps. The app lives in the **menu bar** (no Dock icon). Features and settings are the same as the Windows app.

> **Status: pre-release.** Signed `.dmg` downloads appear once the release pipeline has the Apple signing credentials; until then, run it from source or use the development build from CI (see below).

## Requirements

- macOS 12 Monterey or later (Electron 43), Apple silicon or Intel.

## Install

1. Download the disk image for your Mac: `SonionCompanion-<version>-arm64.dmg` (Apple silicon: M1 or newer) or `SonionCompanion-<version>-x64.dmg` (Intel). Not sure? Apple menu → About This Mac → *Chip* (Apple M…) means arm64.
2. Open it and drag **Sonion Companion** onto **Applications**.
3. Open it from Applications or Launchpad. Release builds are signed and notarized by Apple, so macOS opens them without warnings.

## Run

- The app adds a **menu-bar icon** (a handshake that adapts to light and dark menu bars). Click it for Add companion, Settings and Quit.
- **Settings** opens with **⌘,**, from the menu-bar icon, or by opening the app again (Finder, Launchpad, Spotlight). Only one copy runs at a time.
- The first time you open it with no companions saved, Settings opens automatically.
- Companions stay above normal windows, appear on every Space and stay visible over full-screen apps. They never show up in the Dock or in ⌘-Tab.

### Applications folder

Keep the app in **Applications**: Open at Login and updates only work from there. If you open it from somewhere else (the disk image, Downloads), it offers to **move itself to Applications** and restarts from there (choose *Don't Ask Again* to stop the question).

### Open at Login

The app opens automatically when you log in. It turns this on the first time you open it from Applications. Turn it off with **Open at Login** in the menu-bar menu or in Settings, or in **System Settings → General → Login Items**; your choice is kept and the app never turns it back on by itself. If Settings says it's *waiting for your approval*, allow Sonion Companion under System Settings → General → Login Items. When started at login, the app doesn't open Settings.

### Updates

Choose **Check for Updates…** in the menu-bar menu (or **Check for updates** at the bottom of Settings). If a newer version exists, the app asks before downloading it, then offers to restart now or install it when you quit. It never checks in the background. Updates work for the signed app in Applications; in development builds the item is greyed out. Your companions, layouts and Open at Login choice are kept.

### Uninstall

Quit Sonion Companion from the menu-bar menu, then drag it from Applications to the Trash. Your companions and settings stay in `~/Library/Application Support/Sonion Companion` for a future reinstall; to remove them too, use Settings → **Delete all data…** before uninstalling (or delete that folder).

### Development build from CI (unsigned)

The GitHub Actions workflow **Desktop macOS** (run it manually from the Actions tab, leaving *signed* unchecked) builds the app on a Mac runner, launches it, and uploads screenshots plus `SonionCompanion-dev-arm64.zip` (Apple silicon). The app is only ad-hoc signed, so macOS blocks it when it's downloaded: unzip it, then right-click **Sonion Companion** → **Open** → **Open** (or allow it in System Settings → Privacy & Security).

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

`~/Library/Application Support/Sonion Companion/` (**Open data folder** in Settings): `companions.json`, `asset-cache/`, `session-data/`, `macos-preferences.json` (only the *Don't Ask Again* choice for moving to Applications). Files exported with **Export companions…** work on Windows and macOS alike. **Delete all data…** in Settings quits the app and deletes this folder after confirmation.

## Troubleshooting

- **"Sonion Companion can't be opened"** (development build) — right-click the app → **Open** → **Open**, or allow it in System Settings → Privacy & Security.
- **Open at Login is greyed out** — the app isn't in the Applications folder (or runs from source). Move it to Applications.
- **"Waiting for your approval"** — System Settings → General → Login Items → allow Sonion Companion.
- **No menu-bar icon** — on a crowded menu bar it may be hidden behind the notch or by a menu-bar manager. Open the app again to show Settings.
- **Check for Updates… is greyed out** — updates need the signed release build in the Applications folder (development builds can't update themselves).
- **"Couldn't check for updates"** — "No update has been published yet" means there's nothing newer; otherwise check your internet connection.
- **Companions look greyed out with "z z"** — they're dozing because you've been away; move the mouse or press a key. Settings → **Doze when I'm away** turns it off.

## Development

The desktop apps share most of their code: `standalone_desktop_version/` is an npm workspace with the platform-neutral core in `shared/` (`@sonion/companion-core`) and one folder per OS.

```bash
cd standalone_desktop_version
npm install               # once, at the workspace root
npm test                  # unit tests (shared core + platforms)
cd macos
npm start                 # build and launch from source (needs a Mac)
npm run typecheck         # works on any OS
npm run package:dir       # unpacked app in release/ (needs a Mac; ad-hoc signed)
npm run package           # .dmg + .zip, arm64 + x64 (needs a Mac; ad-hoc signed, not notarized)
npm run package:signed    # release build: Developer ID–signed + notarized (needs a Mac and credentials, see below)
npm run verify:signature -- "release/mac-arm64/Sonion Companion.app" --release   # codesign + Gatekeeper + notarization checks
```

### Release builds: signing and notarization

Release builds are signed with a **Developer ID Application** certificate and **notarized** by Apple, so Gatekeeper opens them without warnings. They're built by the **Desktop macOS** workflow with *signed* checked. It needs an Apple Developer Program membership and these repository secrets (Settings → Secrets and variables → Actions):

| Secret | What it is |
| ------ | ---------- |
| `MACOS_CERTIFICATE_P12_BASE64` | Developer ID Application certificate with its private key, exported from Keychain Access as `.p12`, then base64-encoded (`base64 -i cert.p12 \| pbcopy`) |
| `MACOS_CERTIFICATE_PASSWORD` | Password chosen when exporting the `.p12` |
| `APPLE_API_KEY_P8` | Content of the App Store Connect API key file `AuthKey_XXXXXXXXXX.p8` (Users and Access → Integrations → App Store Connect API, role *Developer*) |
| `APPLE_API_KEY_ID` | That key's ID |
| `APPLE_API_ISSUER` | The issuer ID shown on the same page |

The workflow writes the key to a temporary file, runs `npm run package:signed` (which stops with a clear message if anything is missing instead of producing an unsigned release), checks both apps with `codesign`, `spctl` and `stapler`, runs the smoke test on the arm64 `.dmg`, and uploads the `.dmg`, `.zip`, `.blockmap` files and `latest-mac.yml`.

### Publishing an update

The updater reads `latest-mac.yml` from the GitHub release **`desktop-latest`** (the same release the Windows app uses; each platform has its own `latest*.yml`). To publish version X.Y.Z:

1. Set `"version"` in `package.json` (same version as the other desktop apps built from that commit) and add a `CHANGELOG.md` entry.
2. Run **Desktop macOS** with *signed* and *publish* checked. After the signed build and its checks pass, the `publish` job waits for approval in the **`desktop-release`** environment (add yourself as a required reviewer under Settings → Environments once). It then uploads the `.dmg`, `.zip`, `.blockmap` files and `latest-mac.yml`, and removes the previous macOS files. Windows and Linux files in the release aren't touched; the release is a pre-release, so it never becomes the repository's "Latest".
3. In an older installed copy: menu-bar menu → **Check for Updates…**.

The `.zip` files are what the updater downloads (Apple silicon and Intel each get their own); the `.dmg` files are for new installs.

### Smoke test

`bash scripts/smoke-macos.sh <SonionCompanion-…-arm64.dmg> [--release]` mounts the disk image, installs the app into Applications, verifies the signature (with `--release`: Developer ID, Gatekeeper, notarization), launches it (checks one process, data folder, Open at Login turned on at first launch, menu-bar app type, login item via `sfltool` when `sudo` works without a password), opens it again (still one process), quits and uninstalls (data kept). It moves your data folder aside first and restores it, refuses to replace an existing installation unless `FORCE=1`, and saves screenshots when `SCREENSHOT_DIR` is set. CI runs it on every build. To build locally on a Mac instead: put the certificate in your keychain (or set `CSC_LINK`/`CSC_KEY_PASSWORD`) and set `APPLE_API_KEY` (path to the `.p8`), `APPLE_API_KEY_ID` and `APPLE_API_ISSUER`. Never commit certificates or keys.

Project layout:

- `../shared/` — app logic, data model, renderer pages, updater (shared with Windows)
- `src/platform-macos.ts` — the macOS adapter: menu-bar template icon, no Dock icon, app/Edit menu, `activate` → Settings, window level and Spaces, ⌘ shortcut defaults
- `src/login-item.ts` (+ `login-item-state.ts`, unit-tested) — Open at Login; `src/move-to-applications.ts` — the move prompt
- `SONION_MAC_PANEL=1 npm start` — try companions as non-activating panels (they never take focus from the app you're using); evaluation switch, off by default
- `resources/assets/` — default companion image, `trayTemplate.png` / `trayTemplate@2x.png` (black + alpha)
- `resources/build/icon.png` — 1024 × 1024 app icon (electron-builder turns it into `.icns`); `entitlements.mac.plist` — hardened-runtime exceptions Electron needs
- `scripts/check-signing-env.mjs` — guard for `package:signed`; `scripts/verify-signature.sh` — signature/Gatekeeper/notarization checks; `scripts/smoke-macos.sh` — install round trip
- `src/code-signature.ts` — detects a Developer ID–signed app (updates are enabled only then)

If `npm start` fails with `Cannot read properties of undefined (reading 'getPath')`, the environment variable `ELECTRON_RUN_AS_NODE` is set (some editors set it for their terminals); run `unset ELECTRON_RUN_AS_NODE` and try again.
