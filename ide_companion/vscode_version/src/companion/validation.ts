import { Companion, STATE_ASSET_STATES, StateAssetState } from './Companion';
import { RenderMode, SIZE_LIMITS } from './constants';

export interface ValidationResult {
    companions: Companion[];
    skipped: number;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Validates one stored/imported companion; returns undefined if it can't be used. */
export function validateCompanion(raw: unknown): Companion | undefined {
    if (!isObject(raw)) { return undefined; }

    const id = typeof raw.id === 'number' ? String(raw.id) : raw.id;
    if (!isNonEmptyString(id) || !isNonEmptyString(raw.assetPath)) { return undefined; }
    if (!isFiniteNumber(raw.x) || !isFiniteNumber(raw.y) || !isFiniteNumber(raw.size)) { return undefined; }

    const renderMode: RenderMode | undefined = raw.renderMode === 'panel' || raw.renderMode === 'explorer' ? raw.renderMode : undefined;
    const limits = SIZE_LIMITS[renderMode ?? 'panel'];

    const companion: Companion = {
        id,
        x: clamp(raw.x, 0, 1),
        y: clamp(raw.y, 0, 1),
        size: clamp(raw.size, limits.min, limits.max),
        assetPath: raw.assetPath,
        locked: raw.locked === true
    };
    if (renderMode) {
        companion.renderMode = renderMode;
    }

    if (isObject(raw.stateAssets)) {
        const stateAssets: Partial<Record<StateAssetState, string>> = {};
        for (const state of STATE_ASSET_STATES) {
            const value = raw.stateAssets[state];
            if (isNonEmptyString(value)) {
                stateAssets[state] = value;
            }
        }
        if (Object.keys(stateAssets).length > 0) {
            companion.stateAssets = stateAssets;
        }
    }

    if (isNonEmptyString(raw.behaviorProfile)) {
        companion.behaviorProfile = raw.behaviorProfile;
    }

    return companion;
}

/** Validates a list of companions (world file, profile, stored state). Duplicate ids keep the first entry. */
export function validateCompanions(raw: unknown): ValidationResult {
    if (!Array.isArray(raw)) {
        throw new Error('Expected a JSON array of companions');
    }
    const seen = new Set<string>();
    const companions: Companion[] = [];
    for (const entry of raw) {
        const companion = validateCompanion(entry);
        if (companion && !seen.has(companion.id)) {
            seen.add(companion.id);
            companions.push(companion);
        }
    }
    return { companions, skipped: raw.length - companions.length };
}
