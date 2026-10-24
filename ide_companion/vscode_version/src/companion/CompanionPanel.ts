import * as vscode from 'vscode';
import { CompanionManager } from './CompanionManager';
import { getCompanionHtml } from './companionHtml';
import { AssetResolver, buildRenderMessage, handleWebviewMessage, subscribeRenderer } from './companionView';
import { RuntimeStates } from './RuntimeStates';

export class CompanionPanel {
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
        private states: RuntimeStates
    ){
        const localAssetStorageUri = manager.getLocalAssetStorageUri();
        this.panel = vscode.window.createWebviewPanel(
            'companionPanel',
            'Companion',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    extensionUri,
                    ...(localAssetStorageUri ? [localAssetStorageUri] : [])
                ]
            }
        );

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
