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

            <img id="companion"
                src="https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif"
                style="
                    position:absolute;
                    width:180px;
                    left:100px;
                    top:100px;
                    cursor:grab;
                "
            />

            <script>
                const img = document.getElementById('companion');
                const vscode = acquireVsCodeApi();

                let isDragging = false;
                let offsetX = 0;
                let offsetY = 0;

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
                    isDragging = false;
                    img.style.cursor = 'grab';

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