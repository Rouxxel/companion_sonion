import * as vscode from 'vscode';
import { Companion } from './Companion';
import { CompanionManager } from './CompanionManager';
import { ASSET_FILE_FILTERS, DEFAULT_ASSET_URL, RenderMode } from './constants';

/**
 * Shared logic for the Panel and Explorer renderers: asset resolution,
 * webview message handling and the companion context menu.
 */

const isLocalAsset = (assetPath: string) => typeof assetPath === 'string' && assetPath.startsWith('local:');

export async function resolveAssetUri(manager: CompanionManager, webview: vscode.Webview, assetPath: string): Promise<string> {
    if (!isLocalAsset(assetPath)) {
        return assetPath;
    }
    const fsUri = manager.getLocalAssetFsPath(assetPath);
    if (!fsUri) {
        console.error(`Could not resolve local asset path for: ${assetPath}`);
        return DEFAULT_ASSET_URL;
    }
    try {
        await vscode.workspace.fs.stat(fsUri);
        return webview.asWebviewUri(fsUri).toString();
    } catch (e) {
        console.error(`Local asset not found: ${fsUri.toString()}`, e);
        return DEFAULT_ASSET_URL;
    }
}

export async function getRenderCompanions(manager: CompanionManager, webview: vscode.Webview, mode: RenderMode): Promise<Companion[]> {
    return Promise.all(manager.getAllForMode(mode).map(async c => ({
        ...c,
        assetPath: await resolveAssetUri(manager, webview, c.assetPath)
    })));
}

async function promptAssetUrl(value = ''): Promise<string | undefined> {
    return vscode.window.showInputBox({ prompt: 'Enter new asset URL', value });
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

    const choices = ['Toggle Lock', 'Delete', 'Change Asset URL', 'Import Local Asset', moveLabel];
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
            const uris = await vscode.window.showOpenDialog({ canSelectMany: false, filters: ASSET_FILE_FILTERS });
            if (!uris || uris.length === 0) { return; }
            const marker = await manager.importLocalAsset(uris[0]);
            if (marker) {
                manager.update(id, { assetPath: marker });
            }
            break;
        }
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
