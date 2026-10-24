# Change Log

All notable changes to the "companion-sonion" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

### Changed

- Panel and Explorer companions now share one implementation for the context menu, asset loading and webview messages, so both modes behave identically
- File pickers (sidebar and "Import Local Asset") accept the same formats: PNG, JPG, JPEG, GIF, WebP, WebM, MP4

### Fixed

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
