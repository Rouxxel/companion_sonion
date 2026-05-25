import * as vscode from 'vscode';

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

        webviewView.webview.html = this.getHtml();
    }

    private getHtml(): string {
        return `
        <html>
        <body>
            <h2>Coding Companion</h2>

            <button id="spawn">
                Spawn Companion
            </button>
        </body>
        </html>
        `;
    }
}
