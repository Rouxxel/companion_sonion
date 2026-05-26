import * as vscode from 'vscode';
import { SidebarProvider } from './sidebar/SidebarProvider';
import { CompanionPanel } from './companion/CompanionPanel';
import { CompanionManager } from './companion/CompanionManager';

export function activate(context: vscode.ExtensionContext) {

    const sidebarProvider = new SidebarProvider(context.extensionUri);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'companionSidebar',
            sidebarProvider
        )
    );

    // STATE LAYER
    const manager = new CompanionManager(context.globalState);

    // UI LAYER
    const panel = new CompanionPanel(context.extensionUri, manager);

    // spawn command = just "add companion"
    context.subscriptions.push(
        vscode.commands.registerCommand('companion.spawn', () => {

            manager.create({
                id: Date.now().toString(),
                x: 100,
                y: 100,
                size: 180,
                assetPath: "https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif",
                locked: false
            });

            panel.show();
        })
    );
}

export function deactivate() {}
