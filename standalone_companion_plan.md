# Standalone Companion App - Implementation Plan

A minimalist, borderless floating GIF player designed to be completely UI-free, disappearing from the taskbar so you can display multiple GIFs on screen without clutter.

## Overview

Recreate the core companion-sonion functionality as a standalone desktop application that runs independently of any IDE. Similar to AmaView: Desktop GIFs, this app will provide a clean, overlay-based GIF display system with drag-and-drop, resizing, and asset management capabilities.

## Technology Stack

### Recommended: Electron
- **Why**: Cross-platform support, easy window management, transparent windows, web technologies
- **Alternatives**: Tauri (lighter, Rust-based), Native (platform-specific)

### Core Technologies
- **Frontend**: HTML/CSS/JavaScript (or React/Vue for state management)
- **Window Management**: Electron BrowserWindow with frameless, transparent options
- **Asset Storage**: Local file system + optional URL fetching
- **Persistence**: JSON config file in user data directory

## Core Features

### 1. Window Management
- **Frameless Window**: No title bar, borders, or taskbar presence
- **Transparent Background**: Only GIF content visible, no window chrome
- **Always-on-Top Option**: Toggle to keep companions above other windows
- **Multiple Windows**: Each companion is a separate window instance
- **Z-Index Management**: Click to bring companion to front

### 2. Companion Display
- **GIF/PNG/WebM Support**: Display animated and static images
- **Local Assets**: Load from local file system
- **URL Assets**: Fetch from remote URLs
- **Size Control**: Mouse wheel to resize (40px - 500px range)
- **Default Size**: 180px
- **Default Position**: Center of screen (50%, 50%)

### 3. Interaction
- **Drag & Drop**: Click and hold to move companions
- **Hover Effect**: Reduce opacity to 30% on hover
- **Cursor Changes**: Grab/grabbing cursor states
- **Lock/Unlock**: Prevent accidental movement
- **Double-Click Delete**: Remove companion instantly
- **Right-Click Menu**: Context menu for companion actions

### 4. Context Menu Options
- **Toggle Lock**: Lock/unlock companion position
- **Delete**: Remove companion
- **Change Asset URL**: Update image URL
- **Import Local Asset**: Select local file
- **Clear Local Asset**: Switch back to URL mode
- **Bring to Front**: Adjust z-index

### 5. Asset Management
- **Local File Picker**: Native file dialog for selecting images
- **URL Input**: Text input for remote URLs
- **Asset Validation**: Check file validity before loading
- **Error Handling**: Fallback to default asset on load failure
- **Asset Caching**: Cache remote URLs locally

### 6. Persistence
- **Auto-Save**: Save state on any change
- **JSON Configuration**: Store companion data in user directory
- **Auto-Restore**: Reload companions on app startup
- **Profile System**: Save/load different companion layouts

## Architecture

### Main Process (Electron)
```typescript
// main.ts
- App lifecycle management
- Window creation and management
- File system operations
- IPC communication
- Tray icon (optional, for quick access)
```

### Renderer Process (Each Companion Window)
```typescript
// companion-window.ts
- GIF rendering
- Drag and drop logic
- Mouse wheel resize
- Hover effects
- Context menu
- IPC communication with main process
```

### Shared State Management
```typescript
// companion-manager.ts
- Companion data structure
- CRUD operations
- Persistence layer
- Position calculations
- Asset resolution
```

## Data Model

### Companion Interface
```typescript
interface Companion {
  id: string;
  x: number; // percentage (0-1) of screen width
  y: number; // percentage (0-1) of screen height
  size: number; // pixels
  assetPath: string; // URL or local file path
  assetType: 'url' | 'local';
  locked: boolean;
  opacity: number; // 1.0 or 0.3
  zIndex: number;
}
```

### Configuration File
```json
{
  "companions": [
    {
      "id": "1234567890",
      "x": 0.5,
      "y": 0.5,
      "size": 180,
      "assetPath": "https://example.com/gif.gif",
      "assetType": "url",
      "locked": false,
      "opacity": 1.0,
      "zIndex": 1
    }
  ],
  "settings": {
    "alwaysOnTop": true,
    "defaultSize": 180,
    "minSize": 40,
    "maxSize": 500
  }
}
```

## File Structure

```
standalone-companion/
├── package.json
├── main.ts
├── preload.ts
├── companion-manager.ts
├── assets/
│   └── default.gif
├── renderer/
│   ├── companion-window.html
│   ├── companion-window.ts
│   ├── context-menu.html
│   └── context-menu.ts
├── config/
│   └── companions.json
└── build/
    └── icons/
```

## Implementation Steps

### Phase 1: Core Window Setup
1. Initialize Electron app
2. Create frameless, transparent window
3. Hide from taskbar (skipTaskbar: true)
4. Implement basic GIF rendering
5. Test window positioning (center screen)

### Phase 2: Interaction System
1. Implement drag and drop logic
2. Add mouse wheel resize
3. Implement hover opacity effect
4. Add cursor state changes
5. Test z-index management

### Phase 3: Asset Management
1. Implement local file picker
2. Add URL asset loading
3. Create asset validation
4. Implement error handling
5. Add asset caching

### Phase 4: Context Menu
1. Create custom context menu
2. Implement menu options
3. Add lock/unlock functionality
4. Implement delete action
5. Add asset change options

### Phase 5: Persistence
1. Create JSON config system
2. Implement auto-save
3. Add auto-restore on startup
4. Create profile system
5. Test data integrity

### Phase 6: Polish
1. Add keyboard shortcuts
2. Implement tray icon (optional)
3. Add settings panel
4. Performance optimization
5. Cross-platform testing

## Key Differences from VS Code Extension

### Removed Features
- No sidebar UI
- No command palette integration
- No editor column positioning
- No VS Code-specific APIs

### Enhanced Features
- True overlay windows (not constrained to editor)
- No taskbar presence
- Independent of any IDE
- System-wide availability
- Better performance (no webview overhead)

### Simplified Features
- No starting position options (always center)
- No profile management in UI (config file only)
- No import/export (direct file access)

## Development Considerations

### Performance
- Use efficient GIF rendering libraries
- Implement lazy loading for assets
- Cache remote URLs locally
- Limit maximum companion count

### Cross-Platform
- Test on Windows, macOS, Linux
- Handle platform-specific window behavior
- Manage file system differences
- Test transparency on different OS

### Security
- Validate all file paths
- Sanitize URLs
- Prevent arbitrary code execution
- Secure IPC communication

### User Experience
- Minimal UI footprint
- Intuitive drag and drop
- Smooth animations
- Clear visual feedback

## Potential Challenges

### Window Management
- **Challenge**: Frameless windows on different platforms
- **Solution**: Platform-specific configurations, extensive testing

### Transparency
- **Challenge**: Performance impact of transparent windows
- **Solution**: Efficient rendering, hardware acceleration

### Asset Loading
- **Challenge**: Large GIF files causing lag
- **Solution**: Lazy loading, size limits, optimization

### Multiple Windows
- **Challenge**: Managing many window instances
- **Solution**: Efficient window pooling, cleanup on close

## Future Enhancements

### MVP 2
- Sound effects
- Animation states (idle, active, etc.)
- Behavior profiles
- Companion interactions

### MVP 3
- AI-driven reactions
- Learning behaviors
- Multi-companion coordination
- Advanced animations

## Conclusion

This standalone companion app will provide a clean, minimalist way to display animated GIFs on your desktop without the clutter of traditional applications. By leveraging Electron's cross-platform capabilities and implementing a frameless, transparent window system, users can enjoy their companions anywhere on their screen, not just within an IDE.

The implementation focuses on simplicity and performance, removing IDE-specific constraints while maintaining the core companion functionality that users love.
