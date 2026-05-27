import * as vscode from 'vscode';
import { SidebarProvider } from './sidebar/SidebarProvider';
import { CompanionPanel } from './companion/CompanionPanel';
import { CompanionManager } from './companion/CompanionManager';
import { CompanionExplorerProvider } from './companion/CompanionExplorerProvider';

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

    // EXPLORER SIDEBAR PROVIDER
    const explorerProvider = new CompanionExplorerProvider(context.extensionUri, manager);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'companionExplorer',
            explorerProvider
        )
    );

    // spawn command = just "add companion" (panel mode by default)
    context.subscriptions.push(
        vscode.commands.registerCommand('companion.spawn', async (options?: { assetPath?: string; localAssetUri?: string; size?: number; x?: number; y?: number; renderMode?: 'panel' | 'explorer' }) => {

            const defaultAssetPath = "https://media1.tenor.com/m/Wqi3Xrnz2wwAAAAd/mambo-umamusume.gif";
            const defaultSize = 180;
            const defaultX = 0.5; // center (50%)
            const defaultY = 0.5; // center (50%)

            let assetPath = options?.assetPath || defaultAssetPath;

            if (options?.localAssetUri) {
                const marker = await manager.importLocalAsset(vscode.Uri.file(options.localAssetUri));
                if (marker) {
                    assetPath = marker;
                }
            }

            const renderMode = options?.renderMode || 'panel';

            manager.create({
                id: Date.now().toString(),
                x: options?.x ?? defaultX,
                y: options?.y ?? defaultY,
                size: options?.size ?? defaultSize,
                assetPath: assetPath,
                locked: false,
                renderMode: renderMode
            });

            // Only open panel if spawning in panel mode
            if (renderMode === 'panel') {
                let panel = CompanionPanel.currentPanel;
                if (!panel) {
                    panel = new CompanionPanel(context.extensionUri, manager);
                }
                panel.show();
            }
        })
    );

    // Spawn directly into Explorer mode
    context.subscriptions.push(
        vscode.commands.registerCommand('companion.spawnExplorer', async (options?: { assetPath?: string; localAssetUri?: string; size?: number; x?: number; y?: number }) => {
            await vscode.commands.executeCommand('companion.spawn', {
                ...options,
                renderMode: 'explorer'
            });
        })
    );

    // Move a panel companion to explorer
    context.subscriptions.push(
        vscode.commands.registerCommand('companion.moveToExplorer', async () => {
            const panelCompanions = manager.getAllForMode('panel');
            if (panelCompanions.length === 0) {
                vscode.window.showInformationMessage('No panel companions to move');
                return;
            }
            const items = panelCompanions.map(c => ({ label: c.id, description: c.assetPath }));
            const pick = await vscode.window.showQuickPick(items, { placeHolder: 'Select companion to move to Explorer' });
            if (!pick) { return; }
            manager.moveToMode(pick.label, 'explorer');
            vscode.window.showInformationMessage('Companion moved to Explorer');
        })
    );

    // Move an explorer companion to panel
    context.subscriptions.push(
        vscode.commands.registerCommand('companion.moveToPanel', async () => {
            const explorerCompanions = manager.getAllForMode('explorer');
            if (explorerCompanions.length === 0) {
                vscode.window.showInformationMessage('No explorer companions to move');
                return;
            }
            const items = explorerCompanions.map(c => ({ label: c.id, description: c.assetPath }));
            const pick = await vscode.window.showQuickPick(items, { placeHolder: 'Select companion to move to Panel' });
            if (!pick) { return; }
            manager.moveToMode(pick.label, 'panel');
            vscode.window.showInformationMessage('Companion moved to Panel');
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
