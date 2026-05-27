import * as vscode from 'vscode';
import { CompanionManager } from './CompanionManager';
import { Companion } from './Companion';
import { getCompanionHtml } from './companionHtml';

export class CompanionPanel {
    public static currentPanel: CompanionPanel | undefined;

    private panel: vscode.WebviewPanel;
    private _isDisposed = false;
    private _changeSubscription?: vscode.Disposable;

    private startRenderLoop() {
        // subscribe to manager changes and push updated companion list
        this._changeSubscription = this.manager.onDidChange(() => {
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
        this.panel = vscode.window.createWebviewPanel(
            'companionPanel',
            'Companion',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        //this.panel.webview.onDidReceiveMessage(msg => {
        //    if (msg.command === 'savePosition') {
        //        // save in extension side (we will wire storage next step)
        //        console.log(msg.x, msg.y);
        //    }
        //});

        CompanionPanel.currentPanel = this;

        this.panel.onDidDispose(() => {
            this._isDisposed = true;
            this._changeSubscription?.dispose();
            CompanionPanel.currentPanel = undefined;
        });

        this.panel.webview.onDidReceiveMessage(async (msg) => {
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
                    'Move to Explorer'
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
                if (choice === 'Move to Explorer') {
                    this.manager.moveToMode(id, 'explorer');
                }
            }

            if (msg.command === 'delete') {
                this.manager.delete(msg.id);
            }
        });

        this.startRenderLoop();
        this.panel.webview.html = this.getHtml();
    }

    private async postRender() {
        // Check if panel is disposed before accessing webview
        if (this._isDisposed) {
            return;
        }

        const comps: Companion[] = this.manager.getAllForMode('panel').map((c: Companion) => ({ ...c }));

        // resolve local assets to webview URIs
        for (const c of comps) {
            if (typeof c.assetPath === 'string' && c.assetPath.startsWith('local:')) {
                const fsUri = this.manager.getLocalAssetFsPath(c.assetPath);
                if (fsUri) {
                    try {
                        // Check if file exists before converting
                        try {
                            await vscode.workspace.fs.stat(fsUri);
                            c.assetPath = this.panel.webview.asWebviewUri(fsUri).toString();
                        } catch (statError) {
                            console.error(`Local asset not found: ${fsUri.toString()}`, statError);
                            // Fallback to default asset if local file doesn't exist
                            c.assetPath = 'https://media1.tenor.com/m/Wqi3Xrnz2wwAAAAd/mambo-umamusume.gif';
                        }
                    } catch (e) {
                        console.error('Failed to convert local asset to webview URI:', e);
                        // fallback leave assetPath as is
                    }
                } else {
                    console.error(`Could not resolve local asset path for: ${c.assetPath}`);
                    // Fallback to default asset
                    c.assetPath = 'https://media1.tenor.com/m/Wqi3Xrnz2wwAAAAd/mambo-umamusume.gif';
                }
            }
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