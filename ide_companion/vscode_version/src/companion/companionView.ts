import * as vscode from 'vscode';
import { AssetKind, CompanionChange, CompanionState, ENGINE_STATES, RenderCompanion, ResolvedAsset, STATE_ASSET_STATES, StateAssetState } from './Companion';
import { CompanionManager } from './CompanionManager';
import { RuntimeStates } from './RuntimeStates';
import { ASSET_FILE_FILTERS, DEFAULT_ASSET_URL, RenderMode, VIDEO_EXTENSIONS } from './constants';

/**
 * Shared logic for the Panel and Explorer renderers: asset resolution,
 * webview message handling and the companion context menu.
 */

const isLocalAsset = (assetPath: string) => typeof assetPath === 'string' && assetPath.startsWith('local:');

/** Detects video assets by file extension (query string and fragment ignored). */
export function getAssetKind(assetPath: string): AssetKind {
    const path = (assetPath || '').split(/[?#]/)[0];
    const dot = path.lastIndexOf('.');
    const ext = dot === -1 ? '' : path.substring(dot + 1).toLowerCase();
    return VIDEO_EXTENSIONS.includes(ext) ? 'video' : 'image';
}

const DEFAULT_ASSET: ResolvedAsset = { src: DEFAULT_ASSET_URL, kind: getAssetKind(DEFAULT_ASSET_URL) };

export async function resolveAssetUri(manager: CompanionManager, webview: vscode.Webview, assetPath: string): Promise<ResolvedAsset> {
    if (!isLocalAsset(assetPath)) {
        return { src: assetPath, kind: getAssetKind(assetPath) };
    }
    const fsUri = manager.getLocalAssetFsPath(assetPath);
    if (!fsUri) {
        console.error(`Could not resolve local asset path for: ${assetPath}`);
        return DEFAULT_ASSET;
    }
    try {
        await vscode.workspace.fs.stat(fsUri);
        return { src: webview.asWebviewUri(fsUri).toString(), kind: getAssetKind(assetPath) };
    } catch (e) {
        console.error(`Local asset not found: ${fsUri.toString()}`, e);
        return DEFAULT_ASSET;
    }
}

/**
 * Resolves companions for one webview. Local assets are cached by marker
 * (markers are unique per imported file); the cache is cleared on changes
 * that may affect every companion (profile load, world import).
 */
export class AssetResolver {
    private cache = new Map<string, ResolvedAsset>();

    constructor(private readonly manager: CompanionManager, private readonly webview: vscode.Webview) {}

    onManagerChange(change: CompanionChange) {
        if (!change.ids) {
            this.cache.clear();
        }
    }

    private async resolve(assetPath: string): Promise<ResolvedAsset> {
        if (!isLocalAsset(assetPath)) {
            return resolveAssetUri(this.manager, this.webview, assetPath);
        }
        let resolved = this.cache.get(assetPath);
        if (!resolved) {
            resolved = await resolveAssetUri(this.manager, this.webview, assetPath);
            this.cache.set(assetPath, resolved);
        }
        return resolved;
    }

    async getRenderCompanions(mode: RenderMode, states: RuntimeStates): Promise<RenderCompanion[]> {
        return Promise.all(this.manager.getAllForMode(mode).map(async c => {
            const asset = await this.resolve(c.assetPath);
            const render: RenderCompanion = { ...c, assetPath: asset.src, assetKind: asset.kind, state: states.get(c.id) };
            if (c.stateAssets) {
                const visuals: Partial<Record<StateAssetState, ResolvedAsset>> = {};
                for (const state of STATE_ASSET_STATES) {
                    const path = c.stateAssets[state];
                    if (path) {
                        visuals[state] = await this.resolve(path);
                    }
                }
                render.stateVisuals = visuals;
            }
            return render;
        }));
    }
}

/** Whether the webview should play CSS fallback animations for states without their own asset. */
export function getCssAnimationsEnabled(): boolean {
    return vscode.workspace.getConfiguration('companion.behavior').get<boolean>('cssAnimations', true);
}

/** Builds the 'render' message for a webview. */
export async function buildRenderMessage(assets: AssetResolver, mode: RenderMode, states: RuntimeStates) {
    return {
        command: 'render',
        companions: await assets.getRenderCompanions(mode, states),
        animations: getCssAnimationsEnabled()
    };
}

/**
 * Subscriptions every renderer needs: manager changes and animation-setting
 * changes trigger a full render; runtime state changes for companions shown
 * in this mode are forwarded as 'state' messages.
 */
export function subscribeRenderer(
    manager: CompanionManager,
    states: RuntimeStates,
    mode: RenderMode,
    render: (change?: CompanionChange) => void,
    post: (message: unknown) => void
): vscode.Disposable[] {
    return [
        manager.onDidChange(change => render(change)),
        states.onDidChange(({ id, state }) => {
            const c = manager.get(id);
            if (c && (c.renderMode ?? 'panel') === mode) {
                post({ command: 'state', id, state });
            }
        }),
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('companion.behavior.cssAnimations')) {
                render();
            }
        })
    ];
}

async function promptAssetUrl(value = ''): Promise<string | undefined> {
    return vscode.window.showInputBox({ prompt: 'Enter new asset URL', value });
}

async function pickLocalAsset(manager: CompanionManager): Promise<string | undefined> {
    const uris = await vscode.window.showOpenDialog({ canSelectMany: false, filters: ASSET_FILE_FILTERS });
    if (!uris || uris.length === 0) { return undefined; }
    return manager.importLocalAsset(uris[0]);
}

const describeAsset = (path?: string) => !path ? 'not set' : isLocalAsset(path) ? 'local file' : path;

/** Quick pick over companions (optionally one render mode). */
export async function pickCompanion(manager: CompanionManager, placeHolder: string, mode?: RenderMode): Promise<string | undefined> {
    const companions = mode ? manager.getAllForMode(mode) : manager.getAll();
    if (companions.length === 0) {
        vscode.window.showInformationMessage(mode ? `No ${mode} companions` : 'No companions');
        return undefined;
    }
    const items = companions.map(c => ({ label: c.id, description: describeAsset(c.assetPath), detail: c.renderMode ?? 'panel' }));
    const pick = await vscode.window.showQuickPick(items, { placeHolder });
    return pick?.label;
}

/** Set or clear the asset a companion shows in one animation state. */
export async function promptSetStateAsset(manager: CompanionManager, id: string) {
    const companion = manager.get(id);
    if (!companion) { return; }

    const statePick = await vscode.window.showQuickPick(
        STATE_ASSET_STATES.map(state => ({ label: state, description: describeAsset(companion.stateAssets?.[state]) })),
        { placeHolder: 'Which state? (idle always uses the main asset)' }
    );
    if (!statePick) { return; }
    const state = statePick.label as StateAssetState;
    const current = companion.stateAssets?.[state];

    const actions = ['Use URL', 'Import Local File'];
    if (current) {
        actions.push('Clear (use main asset)');
    }
    const action = await vscode.window.showQuickPick(actions, { placeHolder: `Asset for "${state}"` });
    if (!action) { return; }

    let value: string | undefined;
    if (action === 'Use URL') {
        value = await promptAssetUrl(current && !isLocalAsset(current) ? current : '');
        if (!value) { return; }
    } else if (action === 'Import Local File') {
        value = await pickLocalAsset(manager);
        if (!value) { return; }
    }

    const stateAssets = { ...companion.stateAssets };
    if (value) {
        stateAssets[state] = value;
    } else {
        delete stateAssets[state];
    }
    manager.update(id, { stateAssets: Object.keys(stateAssets).length > 0 ? stateAssets : undefined });
}

/** Temporarily show a companion in a given state (runtime only, not saved). */
export async function promptPreviewState(states: RuntimeStates, id: string) {
    const pick = await vscode.window.showQuickPick(
        ENGINE_STATES.map(state => ({ label: state, description: states.get(id) === state ? 'current' : undefined })),
        { placeHolder: 'Preview which state?' }
    );
    if (pick) {
        states.set(id, pick.label as CompanionState);
    }
}

async function showCompanionContextMenu(
    manager: CompanionManager,
    id: string,
    mode: RenderMode,
    onMoved?: (target: RenderMode) => void
) {
    const companion = manager.get(id);
    if (!companion) { return; }

    const local = isLocalAsset(companion.assetPath);
    const target: RenderMode = mode === 'panel' ? 'explorer' : 'panel';
    const moveLabel = target === 'explorer' ? 'Move to Explorer' : 'Move to Panel';
    const clearLabel = 'Clear current Asset (Switch to URL)';

    const stateAssetLabel = 'Set State Asset…';
    const choices = ['Toggle Lock', 'Delete', 'Change Asset URL', 'Import Local Asset', stateAssetLabel, moveLabel];
    if (local) {
        choices.push(clearLabel);
    }

    const choice = await vscode.window.showQuickPick(choices, { placeHolder: 'Companion actions' });

    switch (choice) {
        case 'Toggle Lock':
            manager.update(id, { locked: !companion.locked });
            break;
        case 'Delete':
            manager.delete(id);
            break;
        case 'Change Asset URL':
        case clearLabel: {
            const url = await promptAssetUrl(choice === 'Change Asset URL' && !local ? companion.assetPath : '');
            if (url) {
                manager.update(id, { assetPath: url });
            }
            break;
        }
        case 'Import Local Asset': {
            const marker = await pickLocalAsset(manager);
            if (marker) {
                manager.update(id, { assetPath: marker });
            }
            break;
        }
        case stateAssetLabel:
            await promptSetStateAsset(manager, id);
            break;
        case moveLabel:
            manager.moveToMode(id, target);
            onMoved?.(target);
            break;
    }
}

export async function handleWebviewMessage(
    manager: CompanionManager,
    msg: any,
    mode: RenderMode,
    onMoved?: (target: RenderMode) => void
) {
    switch (msg?.command) {
        case 'savePosition':
            manager.update(msg.id, { x: msg.x, y: msg.y });
            break;
        case 'resize':
            manager.update(msg.id, { size: msg.size });
            break;
        case 'delete':
            manager.delete(msg.id);
            break;
        case 'contextMenu':
            await showCompanionContextMenu(manager, msg.id, mode, onMoved);
            break;
    }
}
