export const ENGINE_STATES = ['idle', 'typing', 'excited', 'reacting', 'sleeping'] as const;
export type CompanionState = typeof ENGINE_STATES[number];

/** States that can have their own asset; 'idle' always uses the base asset. */
export const STATE_ASSET_STATES = ENGINE_STATES.filter(s => s !== 'idle') as Exclude<CompanionState, 'idle'>[];
export type StateAssetState = Exclude<CompanionState, 'idle'>;

export interface Companion {
    id: string;
    x: number; // percentage (0-1) of window width
    y: number; // percentage (0-1) of window height
    size: number;
    assetPath: string; // base asset (URL or "local:<file>"), used for 'idle' and as fallback
    locked: boolean;
    renderMode?: 'panel' | 'explorer'; // defaults to 'panel' when undefined
    stateAssets?: Partial<Record<StateAssetState, string>>; // URL or "local:<file>" per state
    behaviorProfile?: string; // undefined → default profile
}

export type AssetKind = 'image' | 'video';

export interface ResolvedAsset {
    src: string;
    kind: AssetKind;
}

/** Companion as sent to the webview: assets resolved to webview URIs. */
export interface RenderCompanion extends Companion {
    assetKind: AssetKind;
    state?: CompanionState;
    stateVisuals?: Partial<Record<StateAssetState, ResolvedAsset>>;
}

export interface CompanionChange {
    /** Ids of the changed companions; undefined means everything may have changed. */
    ids?: string[];
}
