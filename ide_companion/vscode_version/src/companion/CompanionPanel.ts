import * as vscode from 'vscode';
import { CompanionManager } from './CompanionManager';
import { getCompanionHtml } from './companionHtml';
import { AssetResolver, handleWebviewMessage } from './companionView';

export class CompanionPanel {
    public static currentPanel: CompanionPanel | undefined;

    private panel: vscode.WebviewPanel;
    private _isDisposed = false;
    private _changeSubscription?: vscode.Disposable;
    private assets: AssetResolver;

    public static createOrShow(extensionUri: vscode.Uri, manager: CompanionManager) {
        const panel = CompanionPanel.currentPanel ?? new CompanionPanel(extensionUri, manager);
        panel.show();
        return panel;
    }

    private startRenderLoop() {
        // subscribe to manager changes and push updated companion list
        this._changeSubscription = this.manager.onDidChange(change => {
            this.assets.onManagerChange(change);
            this.postRender();
        });

        // initial render
        this.postRender();
        console.log("[startRenderLoop] Started render loop");
    }

    constructor(
        extensionUri: vscode.Uri,
        private manager: CompanionManager
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
            this._changeSubscription?.dispose();
            CompanionPanel.currentPanel = undefined;
        });

        this.panel.webview.onDidReceiveMessage(msg => handleWebviewMessage(this.manager, msg, 'panel'));

        this.startRenderLoop();
        this.panel.webview.html = this.getHtml();
    }

    private async postRender() {
        // Check if panel is disposed before accessing webview
        if (this._isDisposed) {
            return;
        }

        const comps = await this.assets.getRenderCompanions('panel');
        if (this._isDisposed) {
            return;
        }

        this.panel.webview.postMessage({ command: 'render', companions: comps });
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
