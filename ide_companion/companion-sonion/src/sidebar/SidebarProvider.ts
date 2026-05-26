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
                body { font-family: var(--vscode-font-family); padding: 12px; }
                h2 { margin-top: 0; }
                .form-group { margin-bottom: 12px; }
                label { display: block; font-weight: 500; margin-bottom: 4px; font-size: 12px; }
                input, select { width: 100%; box-sizing: border-box; padding: 6px; border: 1px solid var(--vscode-input-border); background: var(--vscode-input-background); color: var(--vscode-input-foreground); }
                input:focus, select:focus { outline: none; border-color: var(--vscode-focusBorder); }
                button { width: 100%; padding: 8px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; cursor: pointer; font-size: 13px; margin-top: 8px; }
                button:hover { background: var(--vscode-button-hoverBackground); }
                .info-text { font-size: 11px; color: var(--vscode-descriptionForeground); margin-top: 2px; }
            </style>
        </head>
        <body>
            <h2>Companion Spawner</h2>

            <div class="form-group">
                <label for="assetUrl">Asset URL (or leave blank for default):</label>
                <input type="text" id="assetUrl" placeholder="https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif">
                <div class="info-text">Enter a URL to an image (GIF, PNG, WebM, etc.)</div>
            </div>

            <div class="form-group">
                <label>Local file (optional, overrides URL if selected):</label>
                <button type="button" onclick="pickLocalAsset()">Pick Local File</button>
                <div id="localFileName" class="info-text">No local file selected</div>
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

                function spawn() {
                    const assetUrl = document.getElementById('assetUrl').value || '';
                    const sizeStr = document.getElementById('assetSize').value || '';
                    const position = document.getElementById('startPosition').value || 'center';

                    vscode.postMessage({
                        command: 'spawn',
                        assetPath: assetUrl,
                        localAssetUri: localAssetPath || undefined,
                        size: sizeStr ? parseInt(sizeStr) : undefined,
                        position: position
                    });
                }

                function pickLocalAsset() {
                    vscode.postMessage({ command: 'pickLocalAsset' });
                }

                window.addEventListener('message', event => {
                    const message = event.data;
                    if (message.command === 'localAssetSelected') {
                        localAssetPath = message.path || '';
                        const fileDisplay = document.getElementById('localFileName');
                        if (fileDisplay) {
                            fileDisplay.textContent = localAssetPath ? 'Selected: ' + message.name : 'No local file selected';
                        }
                    }
                });
            </script>
        </body>
        </html>
        `;
    }

}
