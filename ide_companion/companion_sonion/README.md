# companion-sonion

A VS Code extension that brings animated companions into your editor. Spawn, customize, and manage multiple GIF/PNG/WebM companions that persist across sessions.

To generate .vsix locally navigate to companion_sonion folder and run `vsce package` (requirements are `npm install -g @vscode/vsce` and Node.js of course). Then within VSCode Ctrl + Shift + X (Extensions view) and click the gear icon and "Install from VSIX..." to install the generated .vsix file, then reload vscode window.

![Sonion](https://github.com/Rouxxel/companion_sonion/blob/main/ide_companion/companion_sonion/media/sonion.jpeg?raw=true)

## Features

- **Two Render Modes**: Choose between Panel mode (floating window) or Explorer mode (sidebar integration)
- **Spawn Companions**: Quickly add multiple animated companions to your workspace via the sidebar button or command palette
- **Drag & Drop**: Click and hold to move companions around the webview freely
- **Resize**: Use mouse wheel to scale companions up or down (Must be hovering over them to take effect)
- **Hover Effect**: Companions fade to 30% opacity when you hover over them, with cursor changing to a grab hand
- **Lock/Unlock**: Prevent accidental movement by locking a companion (right-click context menu)
- **Delete**: Double-click any companion to instantly remove it
- **Custom Assets**: Change companion images via URL or import local image files (PNG, JPG, GIF, WebM)
- **URL/Local Mode Toggle**: Switch between URL and local file modes in the sidebar with automatic disable logic
- **Clear Local Asset**: Option to clear local file selection and switch back to URL mode
- **Relative Positioning**: Companions use percentage-based positioning (0-1) relative to window size for consistent placement across different screen sizes
- **Split Panel View**: Companion panel opens in split right view for better workspace integration
- **Explorer Sidebar Integration**: Render companions directly in the Explorer sidebar for a compact, always-visible view
- **Mode Switching**: Move companions between Panel and Explorer modes via right-click context menu
- **Profiles**: Save and load entire companion layouts as named profiles
- **Import/Export**: Export your world state to JSON and import it later to restore your companions
- **Persistence**: All companion positions, sizes, and settings are automatically saved and restored on startup

## Usage

### Basic Controls

1. **Choose Render Mode**
   - Use the "Render Mode" dropdown in the Companion sidebar to select:
     - **Panel**: Floating window with free movement
     - **Explorer**: Compact view inside the Explorer sidebar

2. **Spawn a Companion**
   - Click "Spawn Companion" button in the Companion sidebar, or
   - Run command: `Companion: Spawn Companion` (Ctrl+Shift+P) for Panel mode
   - Run command: `Companion: Spawn In Explorer` (Ctrl+Shift+P) for Explorer mode

3. **Move a Companion**
   - Click and hold on a companion, then drag to reposition
   - In Explorer mode, movement is constrained to the sidebar viewport

4. **Resize a Companion**
   - Hover over a companion and scroll the mouse wheel up (enlarge) or down (shrink)
   - Explorer mode: 30-200px range
   - Panel mode: 40px+ range

5. **Delete a Companion**
   - Double-click on any companion to remove it immediately

6. **Access Companion Menu**
   - Right-click on a companion to open the context menu with options:
     - **Toggle Lock**: Prevent/allow movement
     - **Delete**: Remove the companion
     - **Change Asset URL**: Update the image URL
     - **Import Local Asset**: Select a local image file to use
     - **Clear Local Asset (Switch to URL)**: Clear local file selection and switch to URL mode (only shown when local asset is active)
     - **Move to Explorer**: Move companion from Panel to Explorer mode (Panel only)
     - **Move to Panel**: Move companion from Explorer to Panel mode (Explorer only)

### Mode Switching

Move companions between render modes:

- **Move to Explorer**: Right-click a Panel companion → "Move to Explorer"
- **Move to Panel**: Right-click an Explorer companion → "Move to Panel"
- **Quick Move Commands**:
  - `Companion: Move To Explorer` (Ctrl+Shift+P)
  - `Companion: Move To Panel` (Ctrl+Shift+P)

### Profiles

Save and restore companion layouts:

- **Save Profile**: Run `Companion: Save Companion Profile` (Ctrl+Shift+P)
  - Enter a profile name to save the current state

- **Load Profile**: Run `Companion: Load Companion Profile` (Ctrl+Shift+P)
  - Select a saved profile to restore its companions

### Import / Export

- **Export World**: Run `Companion: Export Companion World`
  - Save all companions to a JSON file

- **Import World**: Run `Companion: Import Companion World`
  - Load companions from a previously exported JSON file

## Extension Settings

This extension contributes the following commands:

- `companion.spawn`: Spawn a new companion (Panel mode by default)
- `companion.spawnExplorer`: Spawn a companion in Explorer mode
- `companion.moveToExplorer`: Move a Panel companion to Explorer mode
- `companion.moveToPanel`: Move an Explorer companion to Panel mode
- `companion.saveProfile`: Save current companions as a named profile
- `companion.loadProfile`: Load a saved profile
- `companion.exportWorld`: Export companions to JSON
- `companion.importWorld`: Import companions from JSON

## Known Issues

- Companions reset on extension reload (use profiles to save state)
- Large images or high refresh rates may impact performance
- Explorer mode companions are constrained to the sidebar viewport and cannot overlay native Explorer content

## Release Notes

### 0.2.0

- Added Explorer sidebar render mode
- Mode switching between Panel and Explorer
- Companion visibility handling in Explorer view
- Render mode selection in sidebar UI
- Move to Explorer/Panel commands
- Improved webview disposal handling

### 0.1.0

- Drag and drop movement
- Resize with mouse wheel
- Lock/unlock companions
- Context menu actions
- Profile save/load
- Import/export world state
- Local asset import
- Persistent storage via VS Code globalState
- URL/Local file mode toggle in sidebar
- Clear local asset selection option
- Relative percentage-based positioning for consistent placement
- Split panel view integration
- Improved error handling for local assets
- Webview disposal handling

---

## For more information

- [VS Code Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)
- [VS Code Webview API](https://code.visualstudio.com/api/extension-guides/webview)

**Enjoy your coding companion!**

