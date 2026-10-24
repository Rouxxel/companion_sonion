import * as vscode from 'vscode';
import { validateProfiles } from './profiles';
import { BehaviorConfig, DEFAULT_BEHAVIOR_CONFIG } from './types';

export const BEHAVIOR_SECTION = 'companion.behavior';

export interface ParsedBehaviorConfig {
    config: BehaviorConfig;
    /** invalid user profiles that were skipped */
    errors: string[];
}

const number = (value: unknown, fallback: number, min: number) =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(min, value) : fallback;

/** Builds a BehaviorConfig from raw setting values, clamping numbers and validating profiles. */
export function parseBehaviorConfig(read: (key: keyof BehaviorConfig) => unknown): ParsedBehaviorConfig {
    const d = DEFAULT_BEHAVIOR_CONFIG;
    const bool = (key: 'enabled' | 'reactToErrors') => typeof read(key) === 'boolean' ? read(key) as boolean : d[key];
    const defaultProfile = read('defaultProfile');
    const { profiles, errors } = validateProfiles(read('profiles'));

    return {
        config: {
            enabled: bool('enabled'),
            sleepAfterSeconds: number(read('sleepAfterSeconds'), d.sleepAfterSeconds, 10),
            typingCooldownMs: number(read('typingCooldownMs'), d.typingCooldownMs, 200),
            excitedCharsPerSecond: number(read('excitedCharsPerSecond'), d.excitedCharsPerSecond, 0),
            reactToErrors: bool('reactToErrors'),
            reactionDurationMs: number(read('reactionDurationMs'), d.reactionDurationMs, 100),
            defaultProfile: typeof defaultProfile === 'string' && defaultProfile.trim() ? defaultProfile : d.defaultProfile,
            profiles
        },
        errors
    };
}

export function getBehaviorConfig(): ParsedBehaviorConfig {
    const settings = vscode.workspace.getConfiguration(BEHAVIOR_SECTION);
    return parseBehaviorConfig(key => settings.get(key));
}

export function warnInvalidProfiles(errors: string[]) {
    if (errors.length > 0) {
        vscode.window.showWarningMessage(`Companion: skipped invalid behavior profile(s) in settings: ${errors.join('; ')}`);
    }
}
