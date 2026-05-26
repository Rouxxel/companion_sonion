import * as vscode from 'vscode';
import { CompanionPanel } from '../companion/CompanionPanel';

export class SidebarProvider implements vscode.WebviewViewProvider {

    public static readonly viewType = 'companionSidebar';

    constructor(
        private readonly extensionUri: vscode.Uri
    ) {}

    resolveWebviewView(
        webviewView: vscode.WebviewView
    ) {

        webviewView.webview.options = {
            enableScripts: true
        };

        webviewView.webview.onDidReceiveMessage(async message => {
            if (message.command === 'spawn') {
                const { assetPath, localAssetUri, size, position } = message;

                // Calculate coordinates based on position
                const positions: Record<string, { x: number; y: number }> = {
                    center: { x: 100, y: 100 },
                    topLeft: { x: 50, y: 50 },
                    topRight: { x: 800, y: 50 },
                    bottomLeft: { x: 50, y: 550 },
                    bottomRight: { x: 800, y: 550 }
                };

                const coords = positions[position] || positions.center;

                await vscode.commands.executeCommand('companion.spawn', {
                    assetPath: assetPath || undefined,
                    localAssetUri: localAssetUri || undefined,
                    size: size || undefined,
                    x: coords.x,
                    y: coords.y
                });
            }

            if (message.command === 'pickLocalAsset') {
                const uris = await vscode.window.showOpenDialog({
                    canSelectFiles: true,
                    canSelectMany: false,
                    openLabel: 'Select Companion Asset',
                    filters: {
                        Images: ['png', 'jpg', 'jpeg', 'gif', 'webp'],
                        Videos: ['mp4', 'webm'],
                        All: ['*']
                    }
                });

                if (!uris || uris.length === 0) {
                    return;
                }

                webviewView.webview.postMessage({
                    command: 'localAssetSelected',
                    path: uris[0].fsPath,
                    name: uris[0].path.split('/').pop() || 'selected file'
                });
            }
        });

        webviewView.webview.html = this.getHtml();
    }

    private getHtml(): string {
        return `
        <html>
        <head>
            <style>
                body { font-family: var(--vscode-font-family); padding: 0.75rem; }
                h2 { margin-top: 0; }
                .form-group { margin-bottom: 0.75rem; }
                label { display: block; font-weight: 500; margin-bottom: 0.25rem; font-size: 0.75rem; }
                input, select { width: 100%; box-sizing: border-box; padding: 0.375rem; border: 0.0625rem solid var(--vscode-input-border); background: var(--vscode-input-background); color: var(--vscode-input-foreground); }
                input:focus, select:focus { outline: none; border-color: var(--vscode-focusBorder); }
                input:disabled, button:disabled { opacity: 0.5; cursor: not-allowed; }
                button { width: 100%; padding: 0.5rem; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; cursor: pointer; font-size: 0.8125rem; margin-top: 0.5rem }
                button:hover:not(:disabled) { background: var(--vscode-button-hoverBackground); }
                .info-text { font-size: 0.6875rem; color: var(--vscode-descriptionForeground); margin-top: 0.125rem; }
                .mode-switch { display: flex; gap: 0.5rem margin-bottom: 0.75rem; }
                .mode-switch button { flex: 1; margin-top: 0; }
                .mode-switch button.active { background: var(--vscode-button-secondaryHoverBackground); }
                .clear-btn { width: auto; padding: 0.25rem 0.5rem font-size: 0.6875rem; margin-top: 0.25rem; color: var(--vscode-button-foreground); }
            </style>
        </head>
        <body>
            <h2>Companion Spawner</h2>

            <div class="mode-switch">
                <button type="button" id="urlModeBtn" onclick="setMode('url')" class="active">URL Mode</button>
                <button type="button" id="localModeBtn" onclick="setMode('local')">Local File Mode</button>
            </div>

            <div class="form-group" id="urlGroup">
                <label for="assetUrl">Asset URL (or leave blank for default):</label>
                <input type="text" id="assetUrl" placeholder="https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif">
                <div class="info-text">Enter a URL to an image (GIF, PNG, WebM, etc.)</div>
            </div>

            <div class="form-group" id="localGroup" style="display: none;">
                <label>Local file:</label>
                <button type="button" id="pickLocalBtn" onclick="pickLocalAsset()">Pick Local File</button>
                <div id="localFileName" class="info-text">No local file selected</div>
                <button type="button" id="clearLocalBtn" onclick="clearLocalAsset()" class="clear-btn" style="display: none;">Clear Selection</button>
            </div>

            <div class="form-group">
                <label for="assetSize">Size (pixels, or leave blank for 180):</label>
                <input type="number" id="assetSize" placeholder="180" min="40" max="500">
                <div class="info-text">Companion width in pixels (min: 40)</div>
            </div>

            <div class="form-group">
                <label for="startPosition">Starting Position (or leave blank for center):</label>
                <select id="startPosition">
                    <option value="center">Center</option>
                    <option value="topLeft">Top Left</option>
                    <option value="topRight">Top Right</option>
                    <option value="bottomLeft">Bottom Left</option>
                    <option value="bottomRight">Bottom Right</option>
                </select>
            </div>

            <button onclick="spawn()">Spawn Companion</button>

            <script>
                const vscode = acquireVsCodeApi();
                let localAssetPath = '';
                let currentMode = 'url';

                function setMode(mode) {
                    currentMode = mode;
                    const urlGroup = document.getElementById('urlGroup');
                    const localGroup = document.getElementById('localGroup');
                    const urlModeBtn = document.getElementById('urlModeBtn');
                    const localModeBtn = document.getElementById('localModeBtn');
                    const assetUrl = document.getElementById('assetUrl');
                    const pickLocalBtn = document.getElementById('pickLocalBtn');

                    if (mode === 'url') {
                        urlGroup.style.display = 'block';
                        localGroup.style.display = 'none';
                        urlModeBtn.classList.add('active');
                        localModeBtn.classList.remove('active');
                        assetUrl.disabled = false;
                        pickLocalBtn.disabled = true;
                    } else {
                        urlGroup.style.display = 'none';
                        localGroup.style.display = 'block';
                        urlModeBtn.classList.remove('active');
                        localModeBtn.classList.add('active');
                        assetUrl.disabled = true;
                        pickLocalBtn.disabled = false;
                    }
                }

                function spawn() {
                    const assetUrl = document.getElementById('assetUrl').value || '';
                    const sizeStr = document.getElementById('assetSize').value || '';
                    const position = document.getElementById('startPosition').value || 'center';

                    vscode.postMessage({
                        command: 'spawn',
                        assetPath: currentMode === 'url' ? assetUrl : undefined,
                        localAssetUri: currentMode === 'local' ? localAssetPath : undefined,
                        size: sizeStr ? parseInt(sizeStr) : undefined,
                        position: position
                    });
                }

                function pickLocalAsset() {
                    vscode.postMessage({ command: 'pickLocalAsset' });
                }

                function clearLocalAsset() {
                    localAssetPath = '';
                    const fileDisplay = document.getElementById('localFileName');
                    const clearBtn = document.getElementById('clearLocalBtn');
                    if (fileDisplay) {
                        fileDisplay.textContent = 'No local file selected';
                    }
                    if (clearBtn) {
                        clearBtn.style.display = 'none';
                    }
                }

                window.addEventListener('message', event => {
                    const message = event.data;
                    if (message.command === 'localAssetSelected') {
                        localAssetPath = message.path || '';
                        const fileDisplay = document.getElementById('localFileName');
                        const clearBtn = document.getElementById('clearLocalBtn');
                        if (fileDisplay) {
                            fileDisplay.textContent = localAssetPath ? 'Selected: ' + message.name : 'No local file selected';
                        }
                        if (clearBtn) {
                            clearBtn.style.display = localAssetPath ? 'inline-block' : 'none';
                        }
                    }
                });

                // Initialize with URL mode
                setMode('url');
            </script>
        </body>
        </html>
        `;
    }

}
