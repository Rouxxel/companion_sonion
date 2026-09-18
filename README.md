# companion_sonion

I just wanted a companion on the screen.

![Sonion](sonion.jpeg)

## Projects

### IDE Companion (VS Code Extension)

A VS Code extension that brings animated companions into your editor. Spawn, customize, and manage multiple GIF/PNG/WebM companions that persist across sessions.

**Location:** `ide_companion/vscode_version/`

See the [extension README](ide_companion/vscode_version/README.md) for full details on features, usage, and installation.

### Standalone Desktop Companion (Electron)

A minimalist, borderless floating companion player. Each companion is a transparent, frameless window that stays on top of other applications — no taskbar clutter, no IDE required.

**Location:** `standalone_desktop_version/`

See the [standalone README](standalone_desktop_version/README.md) for setup and controls.

## Quick Start

### VS Code Extension

```bash
cd ide_companion/vscode_version
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

This project is **source-available** under the [Polyform Noncommercial License 1.0.0](LICENSE).

- **Attribution:** If you use this code in any way, you must credit **Sebastian Russo** and **companion_sonion**, include [LICENSE](LICENSE) and [NOTICE](NOTICE), and link to this repository when you distribute it.
- **Noncommercial:** Use for personal, educational, research, and nonprofit purposes is allowed. **Commercial use** (business use or preparing for a business) is **not** allowed without separate written permission from the copyright holder.
- **Third parties:** Dependencies and runtime components (for example Electron) have their own licenses; see [NOTICE](NOTICE).

Apache 2.0 was considered, but it **requires** allowing commercial use, so it cannot enforce a noncommercial-only policy for this repository.
