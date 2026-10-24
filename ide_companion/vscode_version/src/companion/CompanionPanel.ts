import * as vscode from 'vscode';
import { CompanionManager } from './CompanionManager';
import { getCompanionHtml } from './companionHtml';
import { AssetResolver, buildRenderMessage, handleWebviewMessage, subscribeRenderer } from './companionView';
import { RuntimeStates } from './RuntimeStates';

export class CompanionPanel {
    public static readonly viewType = 'companionPanel';
    public static currentPanel: CompanionPanel | undefined;

    private panel: vscode.WebviewPanel;
    private _isDisposed = false;
    private _subscriptions: vscode.Disposable[] = [];
    private assets: AssetResolver;

    public static createOrShow(extensionUri: vscode.Uri, manager: CompanionManager, states: RuntimeStates) {
        const panel = CompanionPanel.currentPanel ?? new CompanionPanel(extensionUri, manager, states);
        panel.show();
        return panel;
    }

    /** Re-attaches to a panel VS Code restored after a window reload (see WebviewPanelSerializer). */
    public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, manager: CompanionManager, states: RuntimeStates) {
        CompanionPanel.currentPanel?.dispose();
        return new CompanionPanel(extensionUri, manager, states, panel);
    }

    private static webviewOptions(extensionUri: vscode.Uri, manager: CompanionManager): vscode.WebviewOptions {
        const localAssetStorageUri = manager.getLocalAssetStorageUri();
        return {
            enableScripts: true,
            localResourceRoots: [
                extensionUri,
                ...(localAssetStorageUri ? [localAssetStorageUri] : [])
            ]
        };
    }

    private startRenderLoop() {
        // subscribe to manager changes and push updated companion list
        this._subscriptions = subscribeRenderer(
            this.manager,
            this.states,
            'panel',
            change => {
                if (change) {
                    this.assets.onManagerChange(change);
                }
                this.postRender();
            },
            message => {
                if (!this._isDisposed) {
                    this.panel.webview.postMessage(message);
                }
            }
        );

        // initial render
        this.postRender();
        console.log("[startRenderLoop] Started render loop");
    }

    constructor(
        extensionUri: vscode.Uri,
        private manager: CompanionManager,
        private states: RuntimeStates,
        existingPanel?: vscode.WebviewPanel
    ){
        const options = CompanionPanel.webviewOptions(extensionUri, manager);
        if (existingPanel) {
            existingPanel.webview.options = options;
            this.panel = existingPanel;
        } else {
            this.panel = vscode.window.createWebviewPanel(
                CompanionPanel.viewType,
                'Companion',
                vscode.ViewColumn.Beside,
                { ...options, retainContextWhenHidden: true }
            );
        }

        this.assets = new AssetResolver(manager, this.panel.webview);
        CompanionPanel.currentPanel = this;

        this.panel.onDidDispose(() => {
            this._isDisposed = true;
            this._subscriptions.forEach(d => d.dispose());
            CompanionPanel.currentPanel = undefined;
        });

        this.panel.webview.onDidReceiveMessage(msg => handleWebviewMessage(this.manager, this.states, msg, 'panel'));

        this.startRenderLoop();
        this.panel.webview.html = this.getHtml();
    }

    private async postRender() {
        // Check if panel is disposed before accessing webview
        if (this._isDisposed) {
            return;
        }

        const message = await buildRenderMessage(this.assets, 'panel', this.states);
        if (this._isDisposed) {
            return;
        }

        this.panel.webview.postMessage(message);
    }

    private getHtml() {
        return getCompanionHtml('panel');
    }

    public show() {
        console.log("[show] Showing companion panel");
        this.panel.reveal();
    }

    public dispose() {
        console.log("[dispose] Disposing companion panel");
        this.panel.dispose();
    }
}
