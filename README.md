# companion_sonion

I just wanted a companion on the screen.

![Sonion](sonion.jpeg)

## Projects

### IDE Companion (VS Code Extension)

A VS Code extension that brings animated companions into your editor. Spawn, customize, and manage multiple GIF/PNG/WebM companions that persist across sessions.

**Location:** `ide_companion/companion_sonion/`

See the [extension README](ide_companion/companion_sonion/README.md) for full details on features, usage, and installation.

### Standalone Desktop Companion (Electron)

A minimalist, borderless floating companion player. Each companion is a transparent, frameless window that stays on top of other applications — no taskbar clutter, no IDE required.

**Location:** `standalone_desktop_version/`

See the [standalone README](standalone_desktop_version/README.md) for setup and controls.

## Quick Start

### VS Code Extension

```bash
cd ide_companion/companion_sonion
npm install
vsce package
# Install the .vsix via Extensions > Install from VSIX
```

### Standalone Desktop App

```bash
cd standalone_desktop_version
npm install
npm start
```

## License

See [LICENSE](LICENSE).
