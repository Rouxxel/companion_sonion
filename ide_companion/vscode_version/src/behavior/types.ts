import { CompanionState } from '../companion/Companion';

/**
 * Behavior events.
 *
 * Sustained events describe a condition; a rule's state holds while the
 * condition lasts:
 *   - typing:       from a user edit until typingCooldownMs without edits
 *   - rapidTyping:  while the typing rate is at or above excitedCharsPerSecond
 *   - inactive:     after sleepAfterSeconds without user activity, until the next activity
 *
 * Momentary events trigger a time-boxed state (durationMs, default reactionDurationMs):
 *   - activity:      user interaction other than typing (selection, editor switch, focus, webview)
 *   - typingStopped: typing cooldown elapsed
 *   - errorAppeared: error count in the active file increased
 *   - errorsCleared: error count in the active file went to 0
 */
export const SUSTAINED_EVENTS = ['typing', 'rapidTyping', 'inactive'] as const;
export const MOMENTARY_EVENTS = ['activity', 'typingStopped', 'errorAppeared', 'errorsCleared'] as const;
export const BEHAVIOR_EVENT_TYPES = [...SUSTAINED_EVENTS, ...MOMENTARY_EVENTS] as const;

export type SustainedEventType = typeof SUSTAINED_EVENTS[number];
export type MomentaryEventType = typeof MOMENTARY_EVENTS[number];
export type BehaviorEventType = typeof BEHAVIOR_EVENT_TYPES[number];

/** Events an activity source may send; the others are derived by the engine. */
export type InputEventType = 'typing' | 'activity' | 'errorAppeared' | 'errorsCleared';

export interface BehaviorEvent {
    type: InputEventType;
    /** languageId of the active editor, if any */
    languageId?: string;
    /** typing only: number of inserted characters */
    chars?: number;
}

export interface BehaviorRule {
    on: BehaviorEventType;
    state: CompanionState;
    /** matches the active editor's languageId */
    when?: { languageId?: string[] };
    /** momentary events only: how long the state lasts (default reactionDurationMs) */
    durationMs?: number;
}

export interface BehaviorProfile {
    name: string;
    rules: BehaviorRule[];
}

export interface BehaviorConfig {
    enabled: boolean;
    sleepAfterSeconds: number;
    typingCooldownMs: number;
    /** 0 disables rapid typing */
    excitedCharsPerSecond: number;
    reactToErrors: boolean;
    reactionDurationMs: number;
    defaultProfile: string;
    /** user-defined profiles (already validated); same name as a built-in overrides it */
    profiles: BehaviorProfile[];
}

export const DEFAULT_BEHAVIOR_CONFIG: BehaviorConfig = {
    enabled: true,
    sleepAfterSeconds: 120,
    typingCooldownMs: 1500,
    excitedCharsPerSecond: 8,
    reactToErrors: true,
    reactionDurationMs: 3000,
    defaultProfile: 'default',
    profiles: []
};

export type TimerHandle = unknown;

export interface Clock {
    now(): number;
    setTimeout(callback: () => void, ms: number): TimerHandle;
    clearTimeout(handle: TimerHandle): void;
}

export const systemClock: Clock = {
    now: () => Date.now(),
    setTimeout: (callback, ms) => setTimeout(callback, ms),
    clearTimeout: handle => clearTimeout(handle as ReturnType<typeof setTimeout>)
};

export interface Disposable {
    dispose(): void;
}

export interface EngineCompanion {
    id: string;
    behaviorProfile?: string;
}

export interface StateChange {
    id: string;
    state: CompanionState;
}
