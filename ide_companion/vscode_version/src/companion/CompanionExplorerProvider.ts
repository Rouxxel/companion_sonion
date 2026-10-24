import * as vscode from 'vscode';
import { CompanionManager } from './CompanionManager';
import { getCompanionHtml } from './companionHtml';
import { CompanionPanel } from './CompanionPanel';
import { getRenderCompanions, handleWebviewMessage } from './companionView';

/**
 * Renders companions inside the VS Code Explorer sidebar
 * using a WebviewViewProvider.
 */
export class CompanionExplorerProvider implements vscode.WebviewViewProvider, vscode.Disposable {

    private webviewView?: vscode.WebviewView;
    private viewDisposables: vscode.Disposable[] = [];

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly manager: CompanionManager
    ) {}

    resolveWebviewView(webviewView: vscode.WebviewView) {
        this.disposeView();
        this.webviewView = webviewView;

        const localAssetStorageUri = this.manager.getLocalAssetStorageUri();
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this.extensionUri,
                ...(localAssetStorageUri ? [localAssetStorageUri] : [])
            ]
        };

        webviewView.webview.html = getCompanionHtml('explorer');

        this.viewDisposables.push(
            // Subscribe to manager changes and push updated companion list
            this.manager.onDidChange(() => {
                this.postRender();
            }),

            // Re-render when the view becomes visible (e.g., when user opens Explorer sidebar)
            webviewView.onDidChangeVisibility(() => {
                if (webviewView.visible) {
                    this.postRender();
                }
            }),

            // Handle messages from the webview
            webviewView.webview.onDidReceiveMessage(msg => handleWebviewMessage(this.manager, msg, 'explorer', target => {
                // Open the panel if it's not already open
                if (target === 'panel') {
                    CompanionPanel.createOrShow(this.extensionUri, this.manager);
                }
            })),

            webviewView.onDidDispose(() => {
                if (this.webviewView === webviewView) {
                    this.disposeView();
                }
            })
        );

        // Initial render
        this.postRender();
    }

    private async postRender() {
        const view = this.webviewView;
        if (!view) { return; }

        const comps = await getRenderCompanions(this.manager, view.webview, 'explorer');
        if (this.webviewView !== view) { return; }

        view.webview.postMessage({ command: 'render', companions: comps });
    }

    private disposeView() {
        this.viewDisposables.forEach(d => d.dispose());
        this.viewDisposables = [];
        this.webviewView = undefined;
    }

    dispose() {
        this.disposeView();
    }
}
