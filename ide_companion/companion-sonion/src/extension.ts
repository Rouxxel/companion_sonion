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
    const manager = new CompanionManager(context.globalState, context.globalStorageUri);

    // UI LAYER
    const panel = new CompanionPanel(context.extensionUri, manager);

    // spawn command = just "add companion"
    context.subscriptions.push(
        vscode.commands.registerCommand('companion.spawn', async (options?: { assetPath?: string; localAssetUri?: string; size?: number; x?: number; y?: number }) => {

            const defaultAssetPath = "https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif";
            const defaultSize = 180;
            const defaultX = 100;
            const defaultY = 100;

            let assetPath = options?.assetPath || defaultAssetPath;

            if (options?.localAssetUri) {
                const marker = await manager.importLocalAsset(vscode.Uri.file(options.localAssetUri));
                if (marker) {
                    assetPath = marker;
                }
            }

            manager.create({
                id: Date.now().toString(),
                x: options?.x ?? defaultX,
                y: options?.y ?? defaultY,
                size: options?.size ?? defaultSize,
                assetPath: assetPath,
                locked: false
            });

            panel.show();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('companion.saveProfile', async () => {
            const name = await vscode.window.showInputBox({ prompt: 'Profile name' });
            if (!name) { return; }
            await manager.saveProfile(name);
            vscode.window.showInformationMessage(`Saved profile ${name}`);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('companion.loadProfile', async () => {
            const profiles = manager.listProfiles();
            if (profiles.length === 0) {
                vscode.window.showInformationMessage('No profiles found');
                return;
            }
            const pick = await vscode.window.showQuickPick(profiles, { placeHolder: 'Select profile to load' });
            if (!pick) { return; }
            await manager.loadProfile(pick);
            vscode.window.showInformationMessage(`Loaded profile ${pick}`);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('companion.exportWorld', async () => {
            const uri = await vscode.window.showSaveDialog({ filters: { JSON: ['json'] } });
            if (!uri) { return; }
            await manager.exportWorld(uri.fsPath);
            vscode.window.showInformationMessage('World exported');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('companion.importWorld', async () => {
            const uris = await vscode.window.showOpenDialog({ canSelectMany: false, filters: { JSON: ['json'] } });
            if (!uris || uris.length === 0) { return; }
            await manager.importWorld(uris[0].fsPath);
            vscode.window.showInformationMessage('World imported');
        })
    );
}

export function deactivate() {}
