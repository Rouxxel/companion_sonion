import * as vscode from 'vscode';
import { CompanionManager } from './CompanionManager';
import { Companion } from './Companion';

export class CompanionPanel {
    public static currentPanel: CompanionPanel | undefined;

    private panel: vscode.WebviewPanel;

    private startRenderLoop() {
        // subscribe to manager changes and push updated companion list
        this.manager.onDidChange(() => {
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
            CompanionPanel.currentPanel = undefined;
        });

        this.panel.webview.onDidReceiveMessage(async (msg) => {
            if (msg.command === 'savePosition') {
                this.manager.update(msg.id, {
                    x: parseInt(msg.x),
                    y: parseInt(msg.y)
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
                    'Import Local Asset'
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
            }

            if (msg.command === 'delete') {
                this.manager.delete(msg.id);
            }
        });

        this.startRenderLoop();
        this.panel.webview.html = this.getHtml();
    }

    private async postRender() {
        const comps: Companion[] = this.manager.getAll().map((c: Companion) => ({ ...c }));

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
        return `
        <!DOCTYPE html>
        <html>
        <body style="margin:0; overflow:hidden;">

            <style>
                #world {
                    position: relative;
                    width: 100vw;
                    height: 100vh;
                }

                img.companion {
                    position: absolute;
                    -webkit-user-drag: none;
                }

                img.companion:hover {
                    opacity: 0.3;
                    cursor: grab;
                }
            </style>

            <div id="world"></div>

            <script>
                const vscode = acquireVsCodeApi();
                const world = document.getElementById('world');

                let companions = [];

                window.addEventListener('message', event => {
                    if (event.data.command === 'render') {
                        companions = event.data.companions;
                        render();
                    }
                });

                const dragState = {
                    item: null,
                    id: null,
                    offsetX: 0,
                    offsetY: 0
                };

                document.addEventListener('mousemove', (e) => {
                    if (!dragState.item) return;

                    dragState.item.style.left = (e.clientX - dragState.offsetX) + 'px';
                    dragState.item.style.top = (e.clientY - dragState.offsetY) + 'px';
                });

                document.addEventListener('mouseup', () => {
                    if (!dragState.item) return;

                    dragState.item.style.cursor = 'grab';

                    vscode.postMessage({
                        command: 'savePosition',
                        id: dragState.id,
                        x: dragState.item.style.left,
                        y: dragState.item.style.top
                    });

                    dragState.item = null;
                    dragState.id = null;
                });

                function render() {
                    if (dragState.item) {
                        return;
                    }

                    world.innerHTML = '';

                    companions.forEach(c => {
                        const img = document.createElement('img');

                        img.className = 'companion';
                        img.src = c.assetPath;
                        img.draggable = false;
                        img.style.left = c.x + 'px';
                        img.style.top = c.y + 'px';
                        img.style.width = c.size + 'px';
                        img.style.opacity = 1;
                        img.style.cursor = c.locked ? 'not-allowed' : 'grab';

                        img.addEventListener('mousedown', (e) => {
                            if (c.locked) return;
                            e.preventDefault();

                            dragState.item = img;
                            dragState.id = c.id;
                            dragState.offsetX = e.clientX - img.offsetLeft;
                            dragState.offsetY = e.clientY - img.offsetTop;
                            img.style.cursor = 'grabbing';
                        });

                        img.addEventListener('wheel', (e) => {
                            e.preventDefault();

                            const size = Math.max(40, c.size + (e.deltaY < 0 ? 10 : -10));

                            vscode.postMessage({
                                command: 'resize',
                                id: c.id,
                                size
                            });
                        });

                        img.addEventListener('contextmenu', (e) => {
                            e.preventDefault();

                            vscode.postMessage({
                                command: 'contextMenu',
                                id: c.id
                            });
                        });

                        img.addEventListener('dblclick', (e) => {
                            e.preventDefault();

                            vscode.postMessage({
                                command: 'delete',
                                id: c.id
                            });
                        });

                        img.addEventListener('mouseenter', () => {
                            img.style.opacity = 0.3;
                        });

                        img.addEventListener('mouseleave', () => {
                            img.style.opacity = 1;
                        });

                        world.appendChild(img);
                    });
                }
            </script>
        </body>
        </html>
        `;
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