import * as vscode from 'vscode';
import { SidebarProvider } from './sidebar/SidebarProvider';
import { CompanionPanel } from './companion/CompanionPanel';

export function activate(context: vscode.ExtensionContext) {

    const sidebarProvider = new SidebarProvider(
        context.extensionUri
    );

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'companionSidebar',
            sidebarProvider
        )
    );

    let panel: CompanionPanel | undefined;

    context.subscriptions.push(
        vscode.commands.registerCommand('companion.spawn', () => {
            if (!panel) {
                panel = new CompanionPanel(context.extensionUri);
            } else {
                panel.show();
            }
        })
    );
}

export function deactivate() {}
