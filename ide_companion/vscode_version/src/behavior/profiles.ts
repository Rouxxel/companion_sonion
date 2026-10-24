import { CompanionState, ENGINE_STATES } from '../companion/Companion';
import { BEHAVIOR_EVENT_TYPES, BehaviorEventType, BehaviorProfile, BehaviorRule } from './types';

const DEFAULT_RULES: BehaviorRule[] = [
    { on: 'typing', state: 'typing' },
    { on: 'rapidTyping', state: 'excited' },
    { on: 'inactive', state: 'sleeping' },
    { on: 'errorAppeared', state: 'reacting' }
];

export const BUILTIN_PROFILES: readonly BehaviorProfile[] = [
    { name: 'default', rules: DEFAULT_RULES },
    { name: 'calm', rules: [{ on: 'inactive', state: 'sleeping' }] },
    { name: 'coder-pet', rules: [...DEFAULT_RULES, { on: 'errorsCleared', state: 'excited', durationMs: 2000 }] },
    { name: 'none', rules: [] }
];

export const FALLBACK_PROFILE = 'default';

export interface ProfileValidationResult {
    profiles: BehaviorProfile[];
    errors: string[];
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function validateRule(raw: unknown, index: number): BehaviorRule | string {
    if (!isObject(raw)) { return `rule ${index + 1} is not an object`; }
    if (!BEHAVIOR_EVENT_TYPES.includes(raw.on as BehaviorEventType)) {
        return `rule ${index + 1}: unknown event "${String(raw.on)}" (allowed: ${BEHAVIOR_EVENT_TYPES.join(', ')})`;
    }
    if (!ENGINE_STATES.includes(raw.state as CompanionState)) {
        return `rule ${index + 1}: unknown state "${String(raw.state)}" (allowed: ${ENGINE_STATES.join(', ')})`;
    }
    const rule: BehaviorRule = { on: raw.on as BehaviorEventType, state: raw.state as CompanionState };

    if (raw.when !== undefined) {
        if (!isObject(raw.when)) { return `rule ${index + 1}: "when" must be an object`; }
        const languageId = raw.when.languageId;
        if (languageId !== undefined) {
            if (!Array.isArray(languageId) || !languageId.every(l => typeof l === 'string' && l.length > 0)) {
                return `rule ${index + 1}: "when.languageId" must be a list of language ids`;
            }
            rule.when = { languageId: [...languageId] };
        }
    }

    if (raw.durationMs !== undefined) {
        if (typeof raw.durationMs !== 'number' || !Number.isFinite(raw.durationMs) || raw.durationMs <= 0) {
            return `rule ${index + 1}: "durationMs" must be a positive number`;
        }
        rule.durationMs = raw.durationMs;
    }
    return rule;
}

/** Validates user-defined profiles; invalid profiles are skipped, each with one error message. */
export function validateProfiles(raw: unknown): ProfileValidationResult {
    const profiles: BehaviorProfile[] = [];
    const errors: string[] = [];
    if (raw === undefined || raw === null) {
        return { profiles, errors };
    }
    if (!Array.isArray(raw)) {
        return { profiles, errors: ['profiles must be a list'] };
    }

    raw.forEach((entry, i) => {
        const label = isObject(entry) && typeof entry.name === 'string' && entry.name ? `"${entry.name}"` : `#${i + 1}`;
        if (!isObject(entry) || typeof entry.name !== 'string' || entry.name.trim() === '') {
            errors.push(`Profile ${label}: missing "name"`);
            return;
        }
        if (!Array.isArray(entry.rules)) {
            errors.push(`Profile ${label}: "rules" must be a list`);
            return;
        }
        const rules: BehaviorRule[] = [];
        for (let r = 0; r < entry.rules.length; r++) {
            const rule = validateRule(entry.rules[r], r);
            if (typeof rule === 'string') {
                errors.push(`Profile ${label}: ${rule}`);
                return;
            }
            rules.push(rule);
        }
        profiles.push({ name: entry.name, rules });
    });

    return { profiles, errors };
}

/** Built-in profiles overlaid with user profiles (same name overrides). */
export function resolveProfiles(userProfiles: readonly BehaviorProfile[]): Map<string, BehaviorProfile> {
    const map = new Map<string, BehaviorProfile>();
    for (const profile of [...BUILTIN_PROFILES, ...userProfiles]) {
        map.set(profile.name, profile);
    }
    return map;
}
