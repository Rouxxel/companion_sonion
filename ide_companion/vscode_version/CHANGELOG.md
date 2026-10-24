# Change Log

All notable changes to the "companion-sonion" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

### Added

- Reactions: companions show `typing` while you type in the active editor, `excited` when you type fast, and `sleeping` after inactivity, and wake on any interaction. Formatter, git, output-panel and undo/redo edits don't count as typing, and reactions never write to your saved companions
- `Companion: Toggle Reactions` command and `companion.behavior.*` settings (enabled, sleepAfterSeconds, typingCooldownMs, excitedCharsPerSecond, reactionDurationMs, defaultProfile, profiles)
- Built-in behavior profiles (`default`, `calm`, `coder-pet`, `none`) and user-defined profiles with language filters
- Animation states (`idle`, `typing`, `excited`, `reacting`, `sleeping`) with an optional asset per state: context menu **Set State Asset…** and command `Companion: Set State Asset`
- Built-in fallback animations for states without their own asset, controlled by the new `companion.behavior.cssAnimations` setting and disabled under reduced motion
- `Companion: Preview State` command to try a state temporarily (not saved)
- WebM and MP4 companions now play (looping, muted); previously they were rendered as images and did not show

### Changed

- Companions are updated individually instead of redrawing the whole view, so moving, resizing or changing one companion no longer restarts the other companions' animations
- Right-click no longer starts a drag; resizing past the size limit no longer triggers a save
- Panel and Explorer companions now share one implementation for the context menu, asset loading and webview messages, so both modes behave identically
- File pickers (sidebar and "Import Local Asset") accept the same formats: PNG, JPG, JPEG, GIF, WebP, WebM, MP4

### Fixed

- Importing a world file or loading a profile validates every entry: invalid entries are skipped and counted instead of breaking the view, out-of-range positions and sizes are clamped, and an invalid file shows an error without touching your current companions
- Explorer view no longer leaks event subscriptions when the view is closed and reopened

### Removed

- Unused `companion.helloWorld` command entry

## [0.2.3] - 2026-10-10

### Changed

- Default companion asset URL updated
- Development dependencies updated (`@vscode/test-cli` 0.0.15)
- License set to PolyForm Noncommercial 1.0.0; repository URL updated to `ide_companion/vscode_version`

### Fixed

- Importing a local asset no longer fails when the extension storage folder does not exist yet

## [0.2.2] - 2026-05-27

### Changed

- Package metadata updates

## [0.2.0] - 2026-05-27

### Added

- Explorer sidebar render mode
- Mode switching between Panel and Explorer (context menu and `Companion: Move To Explorer` / `Companion: Move To Panel` commands)
- Render mode selection in the sidebar
- Companion visibility handling in the Explorer view

### Changed

- Improved webview disposal handling

## [0.1.2] - 2026-05-26

### Changed

- Package metadata updates

## [0.1.1] - 2026-05-26

### Fixed

- Minor fixes

## [0.1.0] - 2026-05-26

### Added

- Drag and drop movement
- Resize with mouse wheel
- Lock/unlock companions
- Context menu actions
- Profile save/load
- Import/export world state
- Local asset import
- Persistent storage via VS Code globalState
- URL/Local file mode toggle in sidebar
- Clear current asset selection option
- Relative percentage-based positioning for consistent placement
- Split panel view integration
- Improved error handling for local assets
- Webview disposal handling
