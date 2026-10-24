# companion-sonion

A VS Code extension that brings animated companions into your editor. Spawn, customize, and manage multiple GIF/PNG/WebP/WebM/MP4 companions that persist across sessions.

To generate .vsix locally navigate to the `ide_companion/vscode_version` folder and run `vsce package` (requirements are `npm install -g @vscode/vsce` and Node.js of course). Then within VSCode Ctrl + Shift + X (Extensions view) and click the gear icon and "Install from VSIX..." to install the generated .vsix file, then reload vscode window.

![Sonion](https://github.com/Rouxxel/companion_sonion/blob/main/ide_companion/vscode_version/media/sonion.jpeg?raw=true)

## Features

- **Two Render Modes**: Choose between Panel mode (floating window) or Explorer mode (sidebar integration)
- **Spawn Companions**: Quickly add multiple animated companions to your workspace via the sidebar button or command palette
- **Drag & Drop**: Click and hold to move companions around the webview freely
- **Resize**: Use mouse wheel to scale companions up or down (Must be hovering over them to take effect)
- **Hover Effect**: Companions fade to 30% opacity when you hover over them, with cursor changing to a grab hand
- **Lock/Unlock**: Prevent accidental movement by locking a companion (right-click context menu)
- **Delete**: Double-click any companion to instantly remove it
- **Custom Assets**: Change companion images via URL or import local files: images (PNG, JPG, GIF, WebP) or looping, muted videos (WebM, MP4)
- **Reactions**: Companions react to you: they type along while you type, get excited when you type fast, fall asleep when you're away, and wake up when you're back
- **State Assets**: Give a companion a different image or video for each animation state (typing, excited, reacting, sleeping); states without their own asset use a built-in animation of the main asset
- **Smooth Updates**: Moving, resizing or changing one companion only updates that companion, so the other animations keep playing without restarting
- **URL/Local Mode Toggle**: Switch between URL and local file modes in the sidebar with automatic disable logic
- **Clear current Asset**: Option to clear local file selection and switch back to URL mode
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
     - **Set State Asset…**: Choose a state, then use a URL, import a local file, or clear it (see [Animation States](#animation-states))
     - **Clear current Asset (Switch to URL)**: Clear local file selection and switch to URL mode (only shown when local asset is active)
     - **Move to Explorer**: Move companion from Panel to Explorer mode (Panel only)
     - **Move to Panel**: Move companion from Explorer to Panel mode (Explorer only)

### Animation States

Each companion can be in one of these states: `idle`, `typing`, `excited`, `reacting`, `sleeping`.

- `idle` always shows the companion's main asset.
- Every other state can have its own asset: right-click → **Set State Asset…**, or run `Companion: Set State Asset`.
- States without their own asset show the main asset with a built-in animation: a small bob (typing), a bounce (excited), a short shake (reacting), or a dimmed, slowly breathing companion with "z z" (sleeping). Turn these off with the `companion.behavior.cssAnimations` setting; they are also disabled when your OS asks for reduced motion.
- To see what a state looks like, run `Companion: Preview State`. Previews are temporary and are not saved; the next reaction replaces them.

### Reactions

Companions switch states on their own based on what you do:

| You… | Companion |
| ---- | --------- |
| type in the active editor | `typing`, back to `idle` ~1.5 s after your last keystroke |
| type fast (≥ 8 characters per second over 3 s) | `excited` |
| do nothing for 2 minutes | `sleeping` |
| type, move the cursor, scroll, switch editors, focus the window, or hover a companion | wakes up |

- Only your edits in the active editor count as typing. Output panels, git, other extensions editing files, Format Document, rename and undo/redo do not, and pastes count as at most 20 characters.
- Turn reactions on or off with `Companion: Toggle Reactions` or the `companion.behavior.enabled` setting. When off, companions always show their main asset.
- Reactions don't change your saved companions: positions, profiles and exports are never touched while you type.
- Tune timings in the settings below, or pick a behavior profile with `companion.behavior.defaultProfile`:
  - `default`: typing, excited and sleeping as described above
  - `calm`: only falls asleep
  - `coder-pet`: like `default` (also reacts to errors once that is available)
  - `none`: no reactions
- You can also write your own profiles in `companion.behavior.profiles`. Each rule maps an event to a state, optionally only for some languages:

```json
"companion.behavior.profiles": [
  {
    "name": "python-buddy",
    "rules": [
      { "on": "typing", "state": "excited", "when": { "languageId": ["python"] } },
      { "on": "typing", "state": "typing" },
      { "on": "inactive", "state": "sleeping" }
    ]
  }
],
"companion.behavior.defaultProfile": "python-buddy"
```

  Events `typing`, `rapidTyping` and `inactive` hold their state while they last. Events `activity` and `typingStopped` show their state briefly (`durationMs`, default `companion.behavior.reactionDurationMs`), and only if it outranks the current one (`reacting` > `excited` > `typing` > `idle` > `sleeping`). Invalid profiles are skipped with a warning.

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
  - Exports from older versions still load. Invalid entries are skipped and reported ("Imported 4 companions, skipped 1 invalid"); positions and sizes outside the allowed range are clamped
  - State assets are included in exports; local files are referenced by name, so they only resolve on the machine that imported them (otherwise the default asset is shown)

## Extension Settings

This extension contributes the following settings:

| Setting | Default | Description |
| ------- | ------- | ----------- |
| `companion.behavior.enabled` | `true` | Let companions react to typing, fast typing and inactivity |
| `companion.behavior.sleepAfterSeconds` | `120` | Seconds without activity before companions fall asleep (min 10) |
| `companion.behavior.typingCooldownMs` | `1500` | Milliseconds after the last keystroke before the typing state ends (min 200) |
| `companion.behavior.excitedCharsPerSecond` | `8` | Typing speed that makes companions excited; `0` disables |
| `companion.behavior.reactionDurationMs` | `3000` | Default length of short reactions in behavior profiles |
| `companion.behavior.defaultProfile` | `"default"` | Behavior profile: `default`, `calm`, `coder-pet`, `none`, or one of your own |
| `companion.behavior.profiles` | `[]` | Your own behavior profiles (see [Reactions](#reactions)) |
| `companion.behavior.cssAnimations` | `true` | Play built-in animations for states that have no asset of their own |

This extension contributes the following commands:

- `companion.spawn`: Spawn a new companion (Panel mode by default)
- `companion.spawnExplorer`: Spawn a companion in Explorer mode
- `companion.moveToExplorer`: Move a Panel companion to Explorer mode
- `companion.moveToPanel`: Move an Explorer companion to Panel mode
- `companion.toggleBehavior`: Turn companion reactions on or off
- `companion.setStateAsset`: Set or clear the asset a companion shows in a given animation state
- `companion.previewState`: Temporarily show a companion in a given animation state
- `companion.saveProfile`: Save current companions as a named profile
- `companion.loadProfile`: Load a saved profile
- `companion.exportWorld`: Export companions to JSON
- `companion.importWorld`: Import companions from JSON

## Known Issues

- The Panel is not reopened automatically after a window reload; your companions are kept and reappear when you spawn a companion or open the panel again
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
- Clear current asset selection option
- Relative percentage-based positioning for consistent placement
- Split panel view integration
- Improved error handling for local assets
- Webview disposal handling

---

## For more information

- [VS Code Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)
- [VS Code Webview API](https://code.visualstudio.com/api/extension-guides/webview)

**Enjoy your coding companion!**

