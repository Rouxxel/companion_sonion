# Sonion Companion (Windows)

A minimalist, borderless floating companion player for Windows. Each companion is a transparent, frameless window that shows a PNG, JPEG, GIF, WebP, BMP, SVG or WebM asset. Companions float above other windows without cluttering the taskbar; the app itself lives in the system tray and can be pinned to the taskbar like any other program.

## Install

### Installer (recommended)

Run `SonionCompanion-Setup-<version>.exe` (for example `SonionCompanion-Setup-0.2.0.exe`) and follow the steps. To build it yourself, see [Build the installer](#build-the-installer).

- It installs **for your user only**, so no administrator rights are needed. The default folder is `%LOCALAPPDATA%\Programs\Sonion Companion`, and you can choose another one.
- It adds a **Start menu** entry and a **desktop shortcut**, and lists the app under **Settings → Apps → Installed apps**.
- **Windows SmartScreen** may show "Windows protected your PC", because the installer isn't code-signed. Click **More info → Run anyway**.

**Pin to the taskbar:** open the Start menu, right-click **Sonion Companion** → **Pin to taskbar** (Windows doesn't let installers pin apps themselves). Clicking the pin while the app runs opens its Settings window.

**Start with Windows:** the installed app starts automatically when you sign in to Windows. It turns this on the first time you open it. To turn it off, uncheck **Start with Windows** in the tray menu or in Settings, or disable it in **Task Manager → Startup apps**. Your choice is kept: the app never turns it back on by itself.

**Updating:** choose **Check for updates…** in the tray menu (or **Check for updates** at the bottom of Settings). If a newer version is available, the app asks before downloading it, then offers to restart now or install it the next time you quit. It never checks or downloads in the background. You can also run a newer installer over the existing installation. Either way, your companions, layouts and the Start with Windows choice are kept.

### Uninstall

Use **Settings → Apps → Installed apps → Sonion Companion → Uninstall** (or *Uninstall Sonion Companion* in the install folder).

- It removes the program, its shortcuts, its Installed apps entry and the Start with Windows entry.
- It then asks **"Also delete your companions, layouts and cached assets?"**. The default is **No**, which keeps `%APPDATA%\Sonion Companion` for a future reinstall.
- Silent uninstalls (`"Uninstall Sonion Companion.exe" /S`) always keep that data.

### Portable `.exe` (no installer)

`SonionCompanion-Portable-<version>.exe` is a single executable you can move anywhere and double-click to run; build it with `npm run package:portable`. It starts more slowly than the installed app (about 10–15 seconds), because it unpacks itself to a temporary folder first. It uses the same data folder as the installed app. It doesn't start with Windows unless you turn that on in the tray menu or Settings. If you move the file afterwards, turn it on again.

## Run

Sonion Companion lives in the **system tray** (near the clock; it may be hidden behind the **^** arrow). Right-click the tray icon for Add companion, Settings, Start with Windows or Quit; left-click opens Settings.

Only one copy runs at a time. Launching it again (Start menu, desktop shortcut or pinned taskbar icon) while it's already running opens the **Settings** window of the running copy instead of starting a second one. The first time you open it with no companions saved, Settings opens automatically (but not when Windows starts it at sign-in).

## Features

- **Transparent frameless windows** — no title bar, no borders, companions don't show up in the taskbar
- **Always on top** — companions float above other applications (can be turned off)
- **Multiple companions** — spawn as many as you want (up to the limit in Settings), each in its own window
- **Drag to reposition** and **mouse-wheel resize** — within the size limits from Settings
- **Aspect-ratio aware** — the window adapts to the image (portrait, landscape, square)
- **Hover opacity** — companions fade while the mouse is over them so they don't block content (30 % by default, adjustable)
- **Per-companion opacity** — make individual companions see-through from their right-click menu
- **Dozing** — companions dim and doze with a little "z z" while you're away from the PC, and wake up when you're back
- **Multiple monitors** — companions remember which monitor they're on
- **Lock/Unlock** — prevent accidental movement
- **Local and remote assets** — pick a file or paste a URL; remote assets are cached after the first download
- **Layouts** — save and load named arrangements of companions
- **Export / import** — move your companions and layouts to another PC, or keep a backup
- **Updates** — check for a new version from the tray
- **Auto-save** — everything is saved automatically
- **System tray and system-wide shortcuts** — add a companion or open Settings from anywhere
- **Start with Windows** — on by default for the installed app

## Controls

### Mouse

| Action | Effect |
|--------|--------|
| Left-click + drag | Move companion (not while locked) |
| Mouse wheel over a companion | Resize it (within the Min/Max size from Settings) |
| Right-click | Open the companion menu |

### Companion menu (right-click)

- **Lock position** / **Unlock position** — stop or allow moving and resizing this companion
- **Always on top** — keep **all** companions above other windows (same as the Settings option)
- **Bring to front** — raise this companion above the others
- **Change asset URL** — show an image, GIF or WebM from the web
- **Import local asset** — pick a file from disk (up to 25 MB)
- **Clear current asset** — go back to the default image
- **Opacity** slider — how see-through this companion is when you're not hovering it (10–100 %); previews while you drag, saved when you let go
- **Add another companion**
- **Delete companion**
- **Close** — close the menu

### Keyboard shortcuts

| Shortcut | Action | Works |
|----------|--------|-------|
| `Ctrl` + `Alt` + `Shift` + `A` | Add a new companion | From any app |
| `Ctrl` + `Alt` + `Shift` + `S` | Open Settings | From any app |
| `Delete` | Remove the focused companion | Companion focused |
| `L` | Toggle lock | Companion focused |
| `Ctrl` + `O` | Import local asset | Companion focused |
| `Ctrl` + `U` | Set asset URL | Companion focused |
| `Escape` | Close the menu or URL dialog | Companion focused |

The two `Ctrl+Alt+Shift` shortcuts are system-wide. They were chosen so they don't take over common shortcuts in other programs (earlier versions used `Ctrl+Shift+A` / `Ctrl+Shift+S`, which blocked *Save As* elsewhere). If another app already uses one of them, Sonion Companion skips it and the other app keeps it. You can change or turn them off in Settings, which also shows whether each one is active. On keyboard layouts with an AltGr key, `Ctrl+Alt` acts as AltGr, so you may want to pick other combinations there.

### System tray

- **Add companion**
- **Settings** (also on left-click)
- **Start with Windows** — checkbox (installed and portable app only; not available when running from source)
- **Check for updates…** — installed app only
- **Quit**

## Settings

Open it with `Ctrl+Alt+Shift+S`, from the tray icon, or by launching the app again from the Start menu or taskbar.

- **Keep companions on top**
- **Default size** — size for new companions
- **Minimum / Maximum size** — limits for mouse-wheel resizing
- **Maximum companions** — how many companions can exist at once
- **Opacity on hover** — how transparent a companion gets while the mouse is over it (5–100 %, default 30 %); applies immediately
- **Doze when I'm away** / **Away after … minutes** — companions doze after Windows has seen no keyboard or mouse input for that long (1–120 minutes, default 5; on by default) and wake up as soon as you're back
- **Start with Windows** — same switch as in the tray menu
- **Keyboard shortcuts** — turn the system-wide shortcuts on or off and change them. Each one shows *Active* or *Not available* (another app uses it, or the combination isn't valid). Use Electron accelerator names, for example `Control+Alt+Shift+A`
- **Layouts** — save, load and delete named layouts. Loading a layout restores companions and their display settings; it doesn't change your shortcuts or Start with Windows
- **Open data folder** — opens the data folder in Explorer
- **Export companions…** / **Import companions…** — see [Moving to another PC](#moving-to-another-pc)
- **Version** and **Check for updates** — at the bottom

The Settings window updates itself when you change Start with Windows from the tray while it's open.

## Data storage

Everything is stored in `%APPDATA%\Sonion Companion\` (**Open data folder** in Settings):

- `companions.json` — companions, settings and layouts
- `asset-cache/` — cached remote assets
- `session-data/` — browser cache used by the app's windows

Local assets are referenced by their path on disk, not copied, so moving or deleting the file shows the default image instead.

### Moving to another PC

**Export companions…** in Settings saves a `.json` file with your companions, their display settings (size limits, hover opacity, keep on top) and your layouts. **Import companions…** on the other PC (or later on the same one) asks for confirmation, then:

- replaces the current companions with the imported ones
- adds the file's layouts (a layout with the same name is replaced)
- keeps that PC's own shortcuts, Start with Windows and dozing settings

Local images are referenced by their path, so copy them to the same place on the other PC (otherwise those companions show the default image). Export first if you want to keep a copy of the companions you're replacing.

### Multiple monitors

Each companion remembers which monitor it's on and returns there after a restart. If that monitor isn't connected, the companion appears on the main monitor (or the monitor it's currently on) and moves back once you reconnect it. Positions saved by version 0.1.0 are placed on the main monitor until you move the companion once.

## Supported formats

PNG, JPEG, GIF, WebP, BMP, SVG and WebM. Local files up to 25 MB, remote files up to 15 MB.

## Troubleshooting

- **Nothing seems to happen when I start it** — it's running in the tray (check behind the **^** arrow near the clock). Launch it again to open Settings.
- **A shortcut doesn't work** — Settings shows *Not available* when another app already uses the combination; pick another one there.
- **"Windows protected your PC" when installing** — the installer isn't code-signed. Click **More info → Run anyway**.
- **"Couldn't check for updates"** — "No update has been published yet" means there's nothing newer to download; otherwise check your internet connection. Updates only work in the installed app (not the portable one).
- **Companions look greyed out with "z z"** — they're dozing because you've been away; move the mouse or press a key. Turn it off in Settings → **Doze when I'm away**.
- **It doesn't start with Windows** — check the tray menu or Settings, and **Task Manager → Startup apps** (it may be disabled there). It's only available in the installed or portable app.
- **Start over with a clean slate** — quit from the tray, then rename or delete `companions.json` in the data folder. The app starts with default settings and one companion.
- **"Your companions file couldn't be read"** — `companions.json` was damaged (for example by a typo while editing it). The app started with defaults and kept the damaged file next to it as `companions.corrupt-<date>.json`. Fix that file and rename it back to `companions.json` (with the app closed) to restore your companions.

## Known limitations

- Windows only.
- The installer isn't code-signed, so SmartScreen warns on first run.
- Very large GIFs may impact performance.
- DPI scaling can occasionally cause minor visual differences, for example when dragging a companion between monitors with different scaling.

## Development

The desktop apps share most of their code: `standalone_desktop_version/` is an npm workspace with the platform-neutral core in `shared/` (`@sonion/companion-core`) and one folder per OS. **Install once at the workspace root**, then run the commands below from `standalone_desktop_version/windows`. Use `npm.cmd` instead of `npm` if PowerShell execution policies block the npm shim.

```powershell
cd standalone_desktop_version
npm install               # First time, at the workspace root (also downloads the Electron binary)
npm test                  # All unit tests: shared core + Windows
cd windows
npm start                 # Build (shared core + Windows) and launch from source
npm run build             # Build the shared core, compile the Windows code, copy resources into dist/
npm run typecheck         # Type-check without emitting
npm test                  # Windows unit tests (startup entry); shared tests run from the workspace root
npm run test:install      # Installer round trip on this PC (see below)
npm run package:dir       # Unpacked app in release/win-unpacked/ (fast check, no installer)
npm run package           # Installer in release/
npm run package:portable  # Portable .exe in release/
```

### Build the installer

```powershell
cd standalone_desktop_version
npm install
cd windows
npm run package
```

This creates `release/SonionCompanion-Setup-<version>.exe`.

`npm run test:install` runs `scripts/smoke-install.ps1` against the newest installer in `release/`. It installs the app silently for your user, checks the shortcuts, the Installed apps entry, single instance, Start with Windows, an update over the existing install and a silent uninstall, then prints PASS/FAIL for each check. It backs up and restores your `companions.json` and uninstalls the app at the end. It won't run while the app is already installed (add `-Force` to replace that installation). Pass `-KeepInstalled` to leave the app installed for manual checks. Use Windows Sandbox or a VM if you'd rather not touch your own profile.

### Publishing an update

The updater looks for the files of the GitHub release with the fixed tag **`desktop-latest`** on `Rouxxel/companion_sonion` (`build.publish` in `package.json`). A fixed tag is used because this repository also publishes VS Code extension releases. To publish version X.Y.Z:

1. Set `"version"` in `package.json` and add a `CHANGELOG.md` entry.
2. `npm run package`. Besides `SonionCompanion-Setup-X.Y.Z.exe`, this writes `SonionCompanion-Setup-X.Y.Z.exe.blockmap` and `latest.yml` to `release/` (or to the out-of-tree folder, see [Build problems](#build-problems)).
3. Upload those **three files** to the `desktop-latest` release and remove the previous version's files. Optionally also keep a versioned release such as `desktop-vX.Y.Z`. With the GitHub CLI:

   ```powershell
   gh release create desktop-latest --title "Sonion Companion (Windows) — latest" --notes "See CHANGELOG.md" --prerelease   # first time only
   gh release upload desktop-latest release\latest.yml release\SonionCompanion-Setup-X.Y.Z.exe release\SonionCompanion-Setup-X.Y.Z.exe.blockmap --clobber
   ```

   Marking it as a pre-release keeps it from becoming the repository's "Latest" release.
4. In the installed app: tray → **Check for updates…**.

`latest.yml` contains the installer's SHA-512, and the updater refuses a download that doesn't match it.

### Code signing (optional)

Builds are unsigned by default, which is why SmartScreen warns. electron-builder signs automatically when a certificate is configured, with no code change needed:

- **Certificate file (.pfx):** set `CSC_LINK` (path or base64 of the `.pfx`) and `CSC_KEY_PASSWORD` before `npm run package`.
- **Azure Trusted Signing:** add `build.win.azureSignOptions` (`publisherName`, `endpoint`, `codeSigningAccountName`, `certificateProfileName`) to `package.json` and provide `AZURE_TENANT_ID`, `AZURE_CLIENT_ID` and `AZURE_CLIENT_SECRET`.

Keep those secrets out of the repository; set them as environment variables or CI secrets only. Once releases are signed, keep signing every release: the updater verifies that a downloaded update is signed by the same publisher as the installed app.

### Project layout

Everything the build needs lives in this folder and `../shared`:

- `../shared/` — the shared core used by every desktop app: main-process logic (`src/app.ts`), data model and multi-monitor geometry, updater, preload, renderer pages (`renderer/`) and their unit tests
- `src/` — the Windows parts: `main.ts` (starts the shared app with the Windows adapter), `platform-windows.ts` (taskbar identity, tray icon, defaults), `autostart.ts` / `startup-entry.ts` (Start with Windows), `src/test/` — unit tests
- `resources/assets/` — default companion image and tray icon (copied into the app)
- `resources/build/` — app/installer icon (`icon.ico`, 16–256 px) and uninstaller steps (`installer.nsh`)
- `scripts/` — build helper and the installer smoke test

Tech stack: Electron, TypeScript (main process and preload), vanilla JS/CSS (renderer), electron-builder (NSIS installer), electron-updater (manual updates).

### Build problems

If `npm start` fails with `Cannot read properties of undefined (reading 'getPath')`, the environment variable `ELECTRON_RUN_AS_NODE` is set (some editors set it for their terminals); clear it with `Remove-Item Env:ELECTRON_RUN_AS_NODE` and try again.

If `npm run package` fails with `…__uninstaller.exe" -> no files found`, Windows Security's **Controlled folder access** (ransomware protection) blocked the installer build from writing into a protected folder such as Documents. You'll see a matching "blocked" notification in Windows Security. Either allow it there (Windows Security → Virus & threat protection → Ransomware protection → Allow an app through Controlled folder access), or build into an unprotected folder:

```powershell
npm run build
npx electron-builder --win nsis "-c.directories.output=$env:LOCALAPPDATA\SonionCompanion-build"
```
