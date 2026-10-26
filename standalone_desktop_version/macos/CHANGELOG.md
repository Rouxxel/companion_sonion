# Change Log

All notable changes to the Sonion Companion desktop app for macOS are documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

### Added

- First macOS build (development, not yet signed): all features of the Windows app — companions, layouts, export/import (files interchangeable with Windows), dozing, hover and per-companion opacity, multi-monitor placement, Settings, system-wide shortcuts
- Menu-bar app: template menu-bar icon for light and dark menu bars, no Dock icon, not in ⌘-Tab; opening the app again shows Settings; ⌘, opens Settings
- Companions appear on every Space and stay visible over full-screen apps
- macOS shortcut defaults ⌘⌥⇧A (add companion) and ⌘⌥⇧S (open Settings); application menu so ⌘C/⌘V/⌘A/⌘Z work in Settings and the URL dialog
- App icon on Apple's icon grid
- ⌘⌫ removes the focused companion (Mac keyboards have no forward Delete key)
- Open at Login: on by default when the app first runs from Applications; turning it off (menu-bar menu, Settings, System Settings → Login Items) is respected; shows when macOS is waiting for your approval; Settings doesn't open when started at login
- Offers to move itself to the Applications folder when opened from the disk image or Downloads (with *Don't Ask Again*)
- Settings → **Delete all data…** quits and deletes your companions, layouts, settings and cached assets
