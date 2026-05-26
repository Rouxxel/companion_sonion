import * as vscode from 'vscode';

export class CompanionPanel {
    public static currentPanel: CompanionPanel | undefined;

    private panel: vscode.WebviewPanel;

    constructor(extensionUri: vscode.Uri) {

        this.panel = vscode.window.createWebviewPanel(
            'companionPanel',
            'Companion',
            vscode.ViewColumn.Active,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this.panel.webview.onDidReceiveMessage(msg => {
            if (msg.command === 'savePosition') {
                // save in extension side (we will wire storage next step)
                console.log(msg.x, msg.y);
            }
        });

        this.panel.webview.html = this.getHtml();
    }

    private getHtml() {
        return `
        <!DOCTYPE html>
        <html>
        <body style="margin:0; overflow:hidden;">

            <style>
                img#companion {
                    position: absolute;
                    width: 180px;
                    left: 100px;
                    top: 100px;
                    -webkit-user-drag: none;
                }

                img#companion:hover {
                    opacity: 0.3;
                    cursor: grab;
                }
            </style>

            <img id="companion"
                src="https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif"
                draggable="false"
            />

            <script>
                const img = document.getElementById('companion');
                const vscode = acquireVsCodeApi();

                let isDragging = false;
                let offsetX = 0;
                let offsetY = 0;

                // prevent native image drag
                img.ondragstart = () => false;

                img.addEventListener('mousedown', (e) => {
                    isDragging = true;
                    const rect = img.getBoundingClientRect();
                    offsetX = e.clientX - rect.left;
                    offsetY = e.clientY - rect.top;
                    img.style.cursor = 'grabbing';
                });

                document.addEventListener('mousemove', (e) => {
                    if (!isDragging) return;

                    img.style.left = (e.clientX - offsetX) + "px";
                    img.style.top = (e.clientY - offsetY) + "px";
                });

                document.addEventListener('mouseup', () => {
                    if (!isDragging) return;
                    isDragging = false;
                    img.style.cursor = '';

                    vscode.postMessage({
                        command: 'savePosition',
                        x: img.style.left,
                        y: img.style.top
                    });
                });
            </script>

        </body>
        </html>
        `;
    }

    public show() {
        this.panel.reveal();
    }

    public dispose() {
        this.panel.dispose();
    }
}