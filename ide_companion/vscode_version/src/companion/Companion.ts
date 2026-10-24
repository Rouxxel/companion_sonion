export interface Companion {
    id: string;
    x: number; // percentage (0-1) of window width
    y: number; // percentage (0-1) of window height
    size: number;
    assetPath: string;
    locked: boolean;
    renderMode?: 'panel' | 'explorer'; // defaults to 'panel' when undefined
}

export type AssetKind = 'image' | 'video';

export interface ResolvedAsset {
    src: string;
    kind: AssetKind;
}

/** Companion as sent to the webview: assets resolved to webview URIs. */
export interface RenderCompanion extends Companion {
    assetKind: AssetKind;
    state?: string;
    stateVisuals?: Partial<Record<string, ResolvedAsset>>;
}

export interface CompanionChange {
    /** Ids of the changed companions; undefined means everything may have changed. */
    ids?: string[];
}
