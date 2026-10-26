# Change Log

All notable changes to the Sonion Companion desktop app for macOS are documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

First macOS release. Same features as the Windows app; `companions.json` and exported files are compatible between both.

### Added

- **Companions:** transparent, frameless windows showing PNG, JPEG, GIF, WebP, BMP, SVG or WebM assets (local files or URLs, cached); drag, scroll to resize, aspect-ratio aware, lock, per-companion opacity, hover opacity, dozing ("z z") while you're away, layouts, export/import, multiple displays
- **Floats everywhere:** companions appear on every Space and stay visible over full-screen apps
- **Menu-bar app:** template menu-bar icon for light and dark menu bars, no Dock icon, not in ⌘-Tab; opening the app again or ⌘, shows Settings; only one copy runs
- **Mac keyboard conventions:** system-wide shortcuts ⌘⌥⇧A (add companion) and ⌘⌥⇧S (Settings), configurable with status; ⌘C/⌘V/⌘A/⌘Z in Settings and the URL dialog; ⌘⌫ removes the focused companion
- **Open at Login:** on by default when the app first runs from Applications; turning it off (menu-bar menu, Settings, System Settings → Login Items) is respected; shows when macOS is waiting for your approval; Settings doesn't open when started at login
- **Applications folder:** offers to move itself there when opened from the disk image or Downloads (with *Don't Ask Again*)
- **Updates:** **Check for Updates…** in the menu-bar menu and Settings (signed app in Applications). Asks before downloading, then restarts now or installs on quit; no background checks
- **Delete all data…** in Settings: quits and deletes your companions, layouts, settings and cached assets after confirmation
- **Distribution:** disk images for Apple silicon (`…-arm64.dmg`) and Intel (`…-x64.dmg`); release builds are signed with a Developer ID certificate, use the hardened runtime and are notarized by Apple
- App icon on Apple's icon grid
- Requires macOS 12 Monterey or later
