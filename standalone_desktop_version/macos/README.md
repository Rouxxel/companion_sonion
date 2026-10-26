# Sonion Companion (macOS)

Floating desktop companions for macOS: transparent, frameless windows showing a PNG, JPEG, GIF, WebP, BMP, SVG or WebM asset that float above other apps, on every Space and over full-screen apps. The app has a **Dock icon** and a **menu-bar icon**. Features and settings are the same as in the Windows app, and exported companions move freely between both.

> **Status: pre-release.** Signed `.dmg` downloads appear once the release pipeline has the Apple signing credentials; until then, run it from source or use the development build from CI (see [Development](#development)).

## Install

**Requirements:** macOS 12 Monterey or later, Apple silicon or Intel.

1. Download `SonionCompanion-<version>-universal.dmg` (for example `SonionCompanion-0.3.0-universal.dmg`). It's a universal app: the same download runs natively on Apple silicon and Intel Macs.
2. Open it and drag **Sonion Companion** onto **Applications**.
3. Open it from Applications or Launchpad. Release builds are signed and notarized by Apple, so macOS opens them without warnings.

**Keep it in Applications:** Open at Login and updates only work from there. If you open it from somewhere else (the disk image, Downloads), it offers to **move itself to Applications** and restarts from there (*Don't Ask Again* stops the question).

**Open at Login:** the app opens automatically when you log in. It turns this on the first time you open it from Applications. Turn it off with **Open at Login** in the menu-bar menu or in Settings, or in **System Settings → General → Login Items**; your choice is kept and the app never turns it back on by itself. If Settings says it's *waiting for your approval*, allow Sonion Companion under System Settings → General → Login Items. When started at login, the app doesn't open Settings.

**Updates:** choose **Check for Updates…** in the menu-bar menu (or **Check for updates** at the bottom of Settings). If a newer version exists, the app asks before downloading it, then offers to restart now or install it when you quit. It never checks in the background. Your companions, layouts and Open at Login choice are kept.

### Uninstall

Quit Sonion Companion from the menu-bar menu, then drag it from Applications to the Trash. Your companions and settings stay in `~/Library/Application Support/Sonion Companion` for a future reinstall. To remove them too, use Settings → **Delete all data…** before uninstalling (or delete that folder). Turn off Open at Login first if you want the Login Items entry gone right away; macOS also drops it once the app is deleted.

## Run

Sonion Companion shows a **Dock icon** and a **menu-bar icon** (a handshake that adapts to light and dark menu bars):

- **Click the Dock icon** to open Settings; right-click it for Add Companion and Settings (plus macOS's own Quit and Options → Keep in Dock).
- **Click the menu-bar icon** for Add companion, Settings, Open at Login, Check for Updates and Quit.
- The app appears in ⌘-Tab like any other app. Companion windows themselves don't get separate entries.

Only one copy runs at a time. Opening the app again (Dock, Finder, Launchpad, Spotlight) shows the **Settings** window of the running copy; **⌘,** opens it too. The first time you open it with no companions saved, Settings opens automatically. Closing Settings doesn't quit the app; quit from the menu-bar menu, the Dock menu or ⌘Q.

## Features

- **Transparent frameless windows** that float above other apps, **on every Space** and **over full-screen apps**
- **Multiple companions**, each in its own window (up to the limit in Settings)
- **Drag to reposition** and **scroll to resize** — within the size limits from Settings
- **Aspect-ratio aware** — the window adapts to the image (portrait, landscape, square)
- **Hover opacity** — companions fade while the pointer is over them (30 % by default, adjustable)
- **Per-companion opacity** from the companion menu
- **Dozing** — companions dim and doze with a little "z z" while you're away from the Mac, and wake up when you're back
- **Multiple displays** — companions remember which display they're on
- **Lock/Unlock** — prevent accidental movement
- **Local and remote assets** — pick a file or paste a URL; remote assets are cached after the first download
- **Layouts**, **export / import** (files interchangeable with the Windows app) and **auto-save**
- **Dock and menu-bar icons**, system-wide shortcuts, **Open at Login** and **manual updates**
- **Universal app** — one download for Apple silicon and Intel

## Controls

### Mouse and trackpad

| Action | Effect |
|--------|--------|
| Click + drag | Move companion (not while locked) |
| Scroll over a companion | Resize it (within the Min/Max size from Settings) |
| Right-click / Control-click / two-finger click | Open the companion menu |

### Companion menu

- **Lock position** / **Unlock position** — stop or allow moving and resizing this companion
- **Always on top** — keep **all** companions above other windows (same as the Settings option)
- **Bring to front** — raise this companion above the others
- **Change asset URL** — show an image, GIF or WebM from the web
- **Import local asset** — pick a file (up to 25 MB)
- **Clear current asset** — go back to the default image
- **Opacity** slider — how see-through this companion is when you're not hovering it (10–100 %)
- **Add another companion** / **Delete companion** / **Close**

### Keyboard shortcuts

| Shortcut | Action | Works |
|----------|--------|-------|
| `⌘` `⌥` `⇧` `A` | Add a new companion | From any app |
| `⌘` `⌥` `⇧` `S` | Open Settings | From any app |
| `⌘` `,` | Open Settings | When the app is active |
| `⌘` `O` / `⌘` `U` | Import local asset / set asset URL | Companion focused |
| `⌘` `⌫` (or `fn` `⌫`) | Remove the companion | Companion focused |
| `L` / `Escape` | Toggle lock / close the menu or URL dialog | Companion focused |
| `⌘` `C` / `⌘` `V` / `⌘` `A` / `⌘` `Z` | Copy / paste / select all / undo in Settings and the URL dialog | |

The two system-wide shortcuts can be changed or turned off in Settings, which also shows whether each one is active (another app may already use a combination). Write them as Electron accelerators, e.g. `Command+Alt+Shift+A`.

### Menu-bar menu and Dock menu

- Menu-bar icon: **Add companion**, **Settings**, **Open at Login** (checkbox), **Check for Updates…**, **Quit**.
- Dock icon (right-click): **Add Companion**, **Settings…**, plus macOS's own items (Options, Show All Windows, Quit).

## Settings

Open it with `⌘⌥⇧S`, `⌘,`, the Dock icon, the menu-bar menu, or by opening the app again.

- **Keep companions on top**, **Default / Minimum / Maximum size**, **Maximum companions**
- **Opacity on hover** — 5–100 %, default 30 %; applies immediately
- **Doze when I'm away** / **Away after … minutes** — 1–120 minutes without keyboard or mouse input, default 5
- **Open at Login** — same switch as in the menu-bar menu, with a note when it's unavailable or waiting for approval
- **Keyboard shortcuts** — turn on/off, change, and see whether each is *Active*
- **Layouts** — save, load, delete. Loading restores companions and display settings, not your shortcuts, Open at Login or dozing
- **Open data folder**, **Export companions…**, **Import companions…**, **Delete all data…**
- **Version** and **Check for updates**

## Data storage

Everything is stored in `~/Library/Application Support/Sonion Companion/` (**Open data folder** in Settings):

- `companions.json` — companions, settings and layouts
- `asset-cache/` — cached remote assets
- `session-data/` — browser cache used by the app's windows
- `macos-preferences.json` — only the *Don't Ask Again* choice for moving to Applications

Local assets are referenced by their path, not copied. **Delete all data…** in Settings quits the app and deletes this folder after confirmation.

### Moving to another Mac or PC

**Export companions…** saves a `.json` file with your companions, display settings and layouts; **Import companions…** on the other computer (Mac or Windows) replaces its companions after confirmation, adds the layouts and keeps that computer's own shortcuts, Open at Login and dozing settings. Copy local images to the same place on the other computer (otherwise those companions show the default image).

### Multiple displays

Each companion remembers which display it's on and returns there after a restart. If that display isn't connected, the companion appears on the main display and moves back once you reconnect it.

## Supported formats

PNG, JPEG, GIF, WebP, BMP, SVG and WebM. Local files up to 25 MB, remote files up to 15 MB.

## Troubleshooting

- **"Sonion Companion can't be opened"** — only development builds show this (release builds are notarized). Right-click the app → **Open** → **Open**, or allow it in System Settings → Privacy & Security.
- **No menu-bar icon** — on a crowded menu bar it may be hidden behind the notch or by a menu-bar manager. Use the Dock icon instead.
- **Open at Login is greyed out** — the app isn't in the Applications folder (or runs from source). Move it to Applications.
- **"Waiting for your approval"** — System Settings → General → Login Items → allow Sonion Companion.
- **A shortcut doesn't work** — Settings shows *Not available* when another app already uses the combination; choose another one.
- **Check for Updates… is greyed out** — updates need the signed release build in the Applications folder.
- **"Couldn't check for updates"** — "No update has been published yet" means there's nothing newer; otherwise check your internet connection.
- **Companions look greyed out with "z z"** — they're dozing because you've been away; move the pointer or press a key. Settings → **Doze when I'm away** turns it off.
- **"Your companions file couldn't be read"** — `companions.json` was damaged; the app started with defaults and kept the damaged file as `companions.corrupt-<date>.json` next to it.
- **Start over** — Settings → **Delete all data…**.

## Known limitations

- macOS 12 or later (Electron 43).
- Companions float at the "floating" window level: system UI (menus, Notification Center, screen savers) stays above them.
- The Dock icon may blink briefly when companions are created (at launch, when adding one): that's macOS switching the window to "visible on all Spaces and over full-screen apps".
- Updates require the signed build in Applications; development builds can't update themselves.
- Very large GIFs may impact performance.

## Development

The desktop apps share most of their code: `standalone_desktop_version/` is an npm workspace with the platform-neutral core in `shared/` (`@sonion/companion-core`) and one folder per OS.

```bash
cd standalone_desktop_version
npm install               # once, at the workspace root
npm test                  # unit tests (shared core + platforms)
cd macos
npm start                 # build and launch from source (needs a Mac)
npm run typecheck         # works on any OS
npm test                  # macOS unit tests (login item state, code signature parsing)
npm run package:dir       # unpacked app in release/ (needs a Mac; ad-hoc signed)
npm run package           # universal .dmg + .zip (needs a Mac; ad-hoc signed, not notarized)
npm run package:signed    # release build: Developer ID–signed + notarized (needs a Mac and credentials)
npm run verify:signature -- "release/mac-universal/Sonion Companion.app" --release   # architectures + codesign + Gatekeeper + notarization
```

If `npm start` fails with `Cannot read properties of undefined (reading 'getPath')`, the environment variable `ELECTRON_RUN_AS_NODE` is set (some editors set it for their terminals); run `unset ELECTRON_RUN_AS_NODE` and try again.

### Development build from CI (no Mac needed)

The GitHub Actions workflow **Desktop macOS** (Actions tab → Run workflow, *signed* unchecked) builds an ad-hoc signed universal `.dmg` on a Mac runner, runs the smoke test on it and uploads the `.dmg`, screenshots and the test output. Because it isn't notarized, macOS blocks the downloaded app: right-click it → **Open** → **Open**.

### Release builds: signing and notarization

Release builds are signed with a **Developer ID Application** certificate and **notarized** by Apple. They're built by **Desktop macOS** with *signed* checked, which needs an Apple Developer Program membership and these repository secrets (Settings → Secrets and variables → Actions):

| Secret | What it is |
| ------ | ---------- |
| `MACOS_CERTIFICATE_P12_BASE64` | Developer ID Application certificate with its private key, exported from Keychain Access as `.p12`, then base64-encoded (`base64 -i cert.p12 \| pbcopy`) |
| `MACOS_CERTIFICATE_PASSWORD` | Password chosen when exporting the `.p12` |
| `APPLE_API_KEY_P8` | Content of the App Store Connect API key file `AuthKey_XXXXXXXXXX.p8` (Users and Access → Integrations → App Store Connect API, role *Developer*) |
| `APPLE_API_KEY_ID` | That key's ID |
| `APPLE_API_ISSUER` | The issuer ID shown on the same page |

The workflow writes the key to a temporary file, runs `npm run package:signed` (which stops with a clear message if anything is missing instead of producing an unsigned release), checks the universal app with `lipo`, `codesign`, `spctl` and `stapler`, runs the smoke test on the `.dmg` in release mode, and uploads the `.dmg`, `.zip`, `.blockmap` files and `latest-mac.yml`.

To build a release locally on a Mac instead: put the certificate in your keychain (or set `CSC_LINK`/`CSC_KEY_PASSWORD`) and set `APPLE_API_KEY` (path to the `.p8`), `APPLE_API_KEY_ID` and `APPLE_API_ISSUER`. Never commit certificates or keys.

### Publishing an update

The updater reads `latest-mac.yml` from the GitHub release **`desktop-latest`** (the same release the Windows app uses; each platform has its own `latest*.yml`). To publish version X.Y.Z:

1. Set `"version"` in `package.json` (same version as the other desktop apps built from that commit) and add a `CHANGELOG.md` entry.
2. Run **Desktop macOS** with *signed* and *publish* checked. After the signed build and its checks pass, the `publish` job waits for approval in the **`desktop-release`** environment (add yourself as a required reviewer under Settings → Environments once). It then uploads the `.dmg`, `.zip`, `.blockmap` files and `latest-mac.yml`, and removes the previous macOS files. Windows and Linux files in the release aren't touched; the release is a pre-release, so it never becomes the repository's "Latest".
3. In an older installed copy: menu-bar menu → **Check for Updates…**.

The universal `.zip` is what the updater downloads; the `.dmg` is for new installs.

### Smoke test

`bash scripts/smoke-macos.sh <SonionCompanion-…-universal.dmg> [--release]` mounts the disk image, installs the app into Applications, verifies the universal binary and the signature (with `--release`: Developer ID, Gatekeeper, notarization), launches it (one process, data folder, Open at Login turned on at first launch, regular app with a Dock icon, login item via `sfltool` when `sudo` works without a password), opens it again (still one process), quits and uninstalls (data kept). It moves your data folder aside first and restores it, refuses to replace an existing installation unless `FORCE=1`, and saves screenshots when `SCREENSHOT_DIR` is set. CI runs it on every build.

### Project layout

- `../shared/` — app logic, data model, renderer pages, updater (shared with Windows)
- `src/platform-macos.ts` — the macOS adapter: Dock icon + Dock menu, menu-bar template icon, app/Edit menu, `activate` → Settings, window level and Spaces, ⌘ shortcut defaults
- `src/login-item.ts` (+ `login-item-state.ts`, unit-tested) — Open at Login; `src/move-to-applications.ts` — the move prompt; `src/code-signature.ts` — detects a Developer ID–signed app (updates are enabled only then)
- `resources/assets/` — default companion image, `trayTemplate.png` / `trayTemplate@2x.png` (black + alpha)
- `resources/build/icon.png` — 1024 × 1024 app icon (electron-builder turns it into `.icns`); `entitlements.mac.plist` — hardened-runtime exceptions Electron needs
- `scripts/` — `copy-static.mjs` (build), `check-signing-env.mjs` (guard for `package:signed`), `verify-signature.sh`, `smoke-macos.sh`
- `SONION_MAC_PANEL=1 npm start` — try companions as non-activating panels (they never take focus from the app you're using); evaluation switch, off by default
