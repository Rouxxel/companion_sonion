import * as vscode from 'vscode';
import { CompanionPanel } from '../companion/CompanionPanel';

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

        webviewView.webview.onDidReceiveMessage(message => {
            if (message.command === 'spawn') {
                vscode.commands.executeCommand('companion.spawn');
            }
        });

        webviewView.webview.html = this.getHtml();
    }

    private getHtml(): string {
        return `
        <html>
        <body>
            <h2>Coding Companion</h2>

            <button onclick="spawn()">Spawn Companion</button>

            <script>
                const vscode = acquireVsCodeApi();

                function spawn() {
                    vscode.postMessage({
                        command: 'spawn'
                    });
                }
            </script>
        </body>
        </html>
        `;
    }
}
