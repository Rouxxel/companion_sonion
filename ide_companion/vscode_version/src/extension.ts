import * as vscode from 'vscode';
import { SidebarProvider } from './sidebar/SidebarProvider';
import { CompanionPanel } from './companion/CompanionPanel';
import { CompanionManager } from './companion/CompanionManager';
import { CompanionExplorerProvider } from './companion/CompanionExplorerProvider';
import { DEFAULT_ASSET_URL, DEFAULT_SIZE } from './companion/constants';
import { pickCompanion, promptPreviewState, promptSetBehaviorProfile, promptSetStateAsset } from './companion/companionView';
import { RuntimeStates } from './companion/RuntimeStates';
import { ActivitySource } from './behavior/ActivitySource';
import { BehaviorEngine } from './behavior/BehaviorEngine';
import { BEHAVIOR_SECTION, getBehaviorConfig, warnInvalidProfiles } from './behavior/config';

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

    // RUNTIME ANIMATION STATE (in memory only)
    const states = new RuntimeStates();
    context.subscriptions.push(
        states,
        manager.onDidChange(() => states.retain(manager.getAll().map(c => c.id)))
    );

    // Reopen the Panel after a window reload if it was open before
    context.subscriptions.push(
        vscode.window.registerWebviewPanelSerializer(CompanionPanel.viewType, {
            async deserializeWebviewPanel(panel: vscode.WebviewPanel) {
                CompanionPanel.revive(panel, context.extensionUri, manager, states);
            }
        })
    );

    // BEHAVIOR ENGINE (reactions to typing / inactivity)
    startBehavior(context, manager, states);

    // EXPLORER SIDEBAR PROVIDER
    const explorerProvider = new CompanionExplorerProvider(context.extensionUri, manager, states);
    context.subscriptions.push(
        explorerProvider,
        vscode.window.registerWebviewViewProvider(
            'companionExplorer',
            explorerProvider
        )
    );

    // spawn command = just "add companion" (panel mode by default)
    context.subscriptions.push(
        vscode.commands.registerCommand('companion.spawn', async (options?: { assetPath?: string; localAssetUri?: string; size?: number; x?: number; y?: number; renderMode?: 'panel' | 'explorer' }) => {

            const defaultX = 0.5; // center (50%)
            const defaultY = 0.5; // center (50%)

            let assetPath = options?.assetPath || DEFAULT_ASSET_URL;

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
                size: options?.size ?? DEFAULT_SIZE,
                assetPath: assetPath,
                locked: false,
                renderMode: renderMode
            });

            // Only open panel if spawning in panel mode
            if (renderMode === 'panel') {
                CompanionPanel.createOrShow(context.extensionUri, manager, states);
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
            const id = await pickCompanion(manager, 'Select companion to move to Explorer', 'panel');
            if (!id) { return; }
            manager.moveToMode(id, 'explorer');
            vscode.window.showInformationMessage('Companion moved to Explorer');
        })
    );

    // Move an explorer companion to panel
    context.subscriptions.push(
        vscode.commands.registerCommand('companion.moveToPanel', async () => {
            const id = await pickCompanion(manager, 'Select companion to move to Panel', 'explorer');
            if (!id) { return; }
            manager.moveToMode(id, 'panel');
            vscode.window.showInformationMessage('Companion moved to Panel');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('companion.setStateAsset', async () => {
            const id = await pickCompanion(manager, 'Select companion');
            if (id) {
                await promptSetStateAsset(manager, id);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('companion.setBehaviorProfile', async () => {
            const id = await pickCompanion(manager, 'Select companion');
            if (id) {
                await promptSetBehaviorProfile(manager, id);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('companion.previewState', async () => {
            const id = await pickCompanion(manager, 'Select companion');
            if (id) {
                await promptPreviewState(states, id);
            }
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
            const result = await manager.loadProfile(pick);
            vscode.window.showInformationMessage(`Loaded profile ${pick}${result?.skipped ? ` (skipped ${result.skipped} invalid)` : ''}`);
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
            try {
                const { companions, skipped } = await manager.importWorld(uris[0].fsPath);
                vscode.window.showInformationMessage(`Imported ${companions.length} companions${skipped ? `, skipped ${skipped} invalid` : ''}`);
            } catch (e) {
                vscode.window.showErrorMessage(`Could not import world: ${e instanceof Error ? e.message : String(e)}`);
            }
        })
    );
}

function startBehavior(context: vscode.ExtensionContext, manager: CompanionManager, states: RuntimeStates) {
    const initial = getBehaviorConfig();
    warnInvalidProfiles(initial.errors);

    const engine = new BehaviorEngine(initial.config);
    let enabled = initial.config.enabled;
    let source: ActivitySource | undefined;

    const syncSource = () => {
        if (enabled && !source) {
            source = new ActivitySource(event => engine.handle(event));
        } else if (!enabled && source) {
            source.dispose();
            source = undefined;
        }
    };

    const syncCompanions = () => engine.setCompanions(manager.getAll());

    engine.onDidChangeState(({ id, state }) => states.set(id, state));
    syncCompanions();
    syncSource();

    context.subscriptions.push(
        manager.onDidChange(syncCompanions),
        states.onDidReportActivity(() => source?.reportActivity()),
        vscode.workspace.onDidChangeConfiguration(e => {
            if (!e.affectsConfiguration(BEHAVIOR_SECTION)) { return; }
            const { config, errors } = getBehaviorConfig();
            warnInvalidProfiles(errors);
            enabled = config.enabled;
            engine.updateConfig(config);
            syncSource();
        }),
        vscode.commands.registerCommand('companion.toggleBehavior', async () => {
            const settings = vscode.workspace.getConfiguration(BEHAVIOR_SECTION);
            const next = !settings.get<boolean>('enabled', true);
            await settings.update('enabled', next, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`Companion reactions ${next ? 'on' : 'off'}`);
        }),
        { dispose: () => { source?.dispose(); engine.dispose(); } }
    );
}

export function deactivate() {}
