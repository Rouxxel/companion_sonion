import * as vscode from 'vscode';
import { CompanionManager } from './CompanionManager';
import { Companion } from './Companion';
import { getCompanionHtml } from './companionHtml';
import { CompanionPanel } from './CompanionPanel';

/**
 * Renders companions inside the VS Code Explorer sidebar
 * using a WebviewViewProvider.
 */
export class CompanionExplorerProvider implements vscode.WebviewViewProvider {

    private webviewView?: vscode.WebviewView;

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly manager: CompanionManager
    ) {}

    resolveWebviewView(webviewView: vscode.WebviewView) {
        this.webviewView = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri]
        };

        webviewView.webview.html = getCompanionHtml('explorer');

        // Subscribe to manager changes and push updated companion list
        this.manager.onDidChange(() => {
            this.postRender();
        });

        // Re-render when the view becomes visible (e.g., when user opens Explorer sidebar)
        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                this.postRender();
            }
        });

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(async (msg) => {
            if (msg.command === 'savePosition') {
                this.manager.update(msg.id, {
                    x: msg.x,
                    y: msg.y
                });
            }

            if (msg.command === 'resize') {
                this.manager.update(msg.id, {
                    size: msg.size
                });
            }

            if (msg.command === 'contextMenu') {
                const id = msg.id;
                const companion = this.manager.get(id);
                if (!companion) { return; }

                const isLocalAsset = typeof companion.assetPath === 'string' && companion.assetPath.startsWith('local:');

                const choices = [
                    'Toggle Lock',
                    'Delete',
                    'Change Asset URL',
                    'Import Local Asset',
                    'Move to Panel'
                ];

                if (isLocalAsset) {
                    choices.push('Clear Local Asset (Switch to URL)');
                }

                const choice = await vscode.window.showQuickPick(choices, { placeHolder: 'Companion actions' });

                if (!choice) { return; }

                if (choice === 'Toggle Lock') {
                    this.manager.update(id, { locked: !companion.locked });
                }

                if (choice === 'Delete') {
                    this.manager.delete(id);
                }

                if (choice === 'Change Asset URL') {
                    const url = await vscode.window.showInputBox({ prompt: 'Enter new asset URL', value: isLocalAsset ? '' : companion.assetPath });
                    if (url) {
                        this.manager.update(id, { assetPath: url });
                    }
                }

                if (choice === 'Import Local Asset') {
                    const uris = await vscode.window.showOpenDialog({ canSelectMany: false, filters: { Images: ['png','jpg','jpeg','gif','webm'] } });
                    if (!uris || uris.length === 0) { return; }
                    const marker = await this.manager.importLocalAsset(uris[0]);
                    if (marker) {
                        this.manager.update(id, { assetPath: marker });
                    }
                }

                if (choice === 'Clear Local Asset (Switch to URL)') {
                    const url = await vscode.window.showInputBox({ prompt: 'Enter new asset URL' });
                    if (url) {
                        this.manager.update(id, { assetPath: url });
                    }
                }

                if (choice === 'Move to Panel') {
                    this.manager.moveToMode(id, 'panel');
                    // Open the panel if it's not already open
                    let panel = CompanionPanel.currentPanel;
                    if (!panel) {
                        panel = new CompanionPanel(this.extensionUri, this.manager);
                    }
                    panel.show();
                }
            }

            if (msg.command === 'delete') {
                this.manager.delete(msg.id);
            }
        });

        // Initial render
        this.postRender();
    }

    private async postRender() {
        if (!this.webviewView) { return; }

        const comps: Companion[] = this.manager.getAllForMode('explorer').map((c: Companion) => ({ ...c }));

        // Resolve local assets to webview URIs
        for (const c of comps) {
            if (typeof c.assetPath === 'string' && c.assetPath.startsWith('local:')) {
                const fsUri = this.manager.getLocalAssetFsPath(c.assetPath);
                if (fsUri) {
                    try {
                        try {
                            await vscode.workspace.fs.stat(fsUri);
                            c.assetPath = this.webviewView.webview.asWebviewUri(fsUri).toString();
                        } catch (statError) {
                            console.error(`Local asset not found: ${fsUri.toString()}`, statError);
                            c.assetPath = 'https://media1.tenor.com/m/Wqi3Xrnz2wwAAAAd/mambo-umamusume.gif';
                        }
                    } catch (e) {
                        console.error('Failed to convert local asset to webview URI:', e);
                    }
                } else {
                    console.error(`Could not resolve local asset path for: ${c.assetPath}`);
                    c.assetPath = 'https://media1.tenor.com/m/Wqi3Xrnz2wwAAAAd/mambo-umamusume.gif';
                }
            }
        }

        this.webviewView.webview.postMessage({ command: 'render', companions: comps });
    }
}
