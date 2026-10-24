import { CompanionState } from '../companion/Companion';
import { Emitter } from './Emitter';
import { FALLBACK_PROFILE, resolveProfiles } from './profiles';
import {
    BehaviorConfig,
    BehaviorEvent,
    BehaviorEventType,
    BehaviorProfile,
    BehaviorRule,
    Clock,
    DEFAULT_BEHAVIOR_CONFIG,
    EngineCompanion,
    MomentaryEventType,
    StateChange,
    systemClock,
    TimerHandle
} from './types';

/** Higher wins when a time-boxed state competes with the sustained (base) state. */
export const STATE_PRIORITY: Record<CompanionState, number> = {
    sleeping: 0,
    idle: 1,
    typing: 2,
    excited: 3,
    reacting: 4
};

export const RAPID_WINDOW_MS = 3000;
export const MAX_CHARS_PER_CHANGE = 20;

interface Overlay {
    state: CompanionState;
    timer: TimerHandle;
}

/**
 * Turns activity events into per-companion animation states.
 *
 * Pure TypeScript (no vscode import); time comes from an injected Clock.
 * State is in memory only and is emitted only when a companion's effective
 * state changes, never per event.
 */
export class BehaviorEngine {
    private config: BehaviorConfig;
    private profiles: Map<string, BehaviorProfile>;
    private companions: EngineCompanion[] = [];
    private effective = new Map<string, CompanionState>();
    private overlays = new Map<string, Overlay>();

    // Sustained conditions (shared by all companions)
    private typing = false;
    private rapid = false;
    private inactive = false;
    private samples: { at: number; chars: number }[] = [];
    private lastLanguageId?: string;

    private typingTimer?: TimerHandle;
    private inactivityTimer?: TimerHandle;
    private disposed = false;

    private readonly _onDidChangeState = new Emitter<StateChange>();
    readonly onDidChangeState = this._onDidChangeState.event;

    constructor(config: Partial<BehaviorConfig> = {}, private readonly clock: Clock = systemClock) {
        this.config = { ...DEFAULT_BEHAVIOR_CONFIG, ...config };
        this.profiles = resolveProfiles(this.config.profiles);
        if (this.config.enabled) {
            this.restartInactivityTimer();
        }
    }

    // ---- public API ----

    setCompanions(companions: EngineCompanion[]) {
        this.companions = companions.map(c => ({ id: c.id, behaviorProfile: c.behaviorProfile }));
        const ids = new Set(this.companions.map(c => c.id));
        for (const id of [...this.effective.keys()]) {
            if (!ids.has(id)) {
                this.effective.delete(id);
                this.clearOverlay(id);
            }
        }
        this.recompute();
    }

    getState(id: string): CompanionState {
        return this.effective.get(id) ?? 'idle';
    }

    handle(event: BehaviorEvent) {
        if (this.disposed || !this.config.enabled) { return; }
        if (event.languageId) {
            this.lastLanguageId = event.languageId;
        }

        switch (event.type) {
            case 'typing':
                this.markActive();
                this.onTyping(event.chars ?? 1);
                break;
            case 'activity':
                this.markActive();
                this.triggerMomentary('activity', event.languageId);
                break;
            case 'errorAppeared':
            case 'errorsCleared':
                if (this.config.reactToErrors) {
                    this.triggerMomentary(event.type, event.languageId);
                }
                break;
        }
        this.recompute();
    }

    updateConfig(config: Partial<BehaviorConfig>) {
        if (this.disposed) { return; }
        const wasEnabled = this.config.enabled;
        this.config = { ...this.config, ...config };
        this.profiles = resolveProfiles(this.config.profiles);

        if (!this.config.enabled) {
            this.resetConditions();
        } else if (!wasEnabled || config.sleepAfterSeconds !== undefined) {
            this.restartInactivityTimer();
        }
        this.recompute();
    }

    dispose() {
        this.disposed = true;
        this.resetConditions();
        this._onDidChangeState.dispose();
    }

    // ---- conditions ----

    private markActive() {
        this.inactive = false;
        this.restartInactivityTimer();
    }

    private restartInactivityTimer() {
        this.clearTimer(this.inactivityTimer);
        this.inactivityTimer = this.clock.setTimeout(() => {
            this.inactivityTimer = undefined;
            this.inactive = true;
            this.recompute();
        }, this.config.sleepAfterSeconds * 1000);
    }

    private onTyping(chars: number) {
        const now = this.clock.now();
        this.typing = true;
        this.samples.push({ at: now, chars: Math.min(Math.max(chars, 0), MAX_CHARS_PER_CHANGE) });
        this.samples = this.samples.filter(s => now - s.at < RAPID_WINDOW_MS);

        const threshold = this.config.excitedCharsPerSecond;
        const total = this.samples.reduce((sum, s) => sum + s.chars, 0);
        this.rapid = threshold > 0 && total / (RAPID_WINDOW_MS / 1000) >= threshold;

        this.clearTimer(this.typingTimer);
        this.typingTimer = this.clock.setTimeout(() => {
            this.typingTimer = undefined;
            this.typing = false;
            this.rapid = false;
            this.samples = [];
            this.triggerMomentary('typingStopped');
            this.recompute();
        }, this.config.typingCooldownMs);
    }

    private resetConditions() {
        this.clearTimer(this.typingTimer);
        this.clearTimer(this.inactivityTimer);
        this.typingTimer = this.inactivityTimer = undefined;
        this.typing = this.rapid = this.inactive = false;
        this.samples = [];
        for (const id of [...this.overlays.keys()]) {
            this.clearOverlay(id);
        }
    }

    // ---- rules ----

    private profileFor(c: EngineCompanion): BehaviorProfile {
        return this.profiles.get(c.behaviorProfile ?? this.config.defaultProfile)
            ?? this.profiles.get(this.config.defaultProfile)
            ?? this.profiles.get(FALLBACK_PROFILE)!;
    }

    private matchRule(profile: BehaviorProfile, on: BehaviorEventType, languageId: string | undefined): BehaviorRule | undefined {
        return profile.rules.find(r => r.on === on
            && (!r.when?.languageId || (languageId !== undefined && r.when.languageId.includes(languageId))));
    }

    private triggerMomentary(type: MomentaryEventType, languageId = this.lastLanguageId) {
        for (const c of this.companions) {
            const rule = this.matchRule(this.profileFor(c), type, languageId);
            if (!rule) { continue; }
            this.clearOverlay(c.id);
            const timer = this.clock.setTimeout(() => {
                this.overlays.delete(c.id);
                this.recompute();
            }, rule.durationMs ?? this.config.reactionDurationMs);
            this.overlays.set(c.id, { state: rule.state, timer });
        }
    }

    private clearOverlay(id: string) {
        const overlay = this.overlays.get(id);
        if (overlay) {
            this.clearTimer(overlay.timer);
            this.overlays.delete(id);
        }
    }

    private clearTimer(handle: TimerHandle | undefined) {
        if (handle !== undefined) {
            this.clock.clearTimeout(handle);
        }
    }

    // ---- state ----

    private computeState(c: EngineCompanion): CompanionState {
        if (!this.config.enabled) { return 'idle'; }
        const profile = this.profileFor(c);
        const sustained = (on: BehaviorEventType) => this.matchRule(profile, on, this.lastLanguageId)?.state;

        let base: CompanionState | undefined;
        if (this.rapid) { base = sustained('rapidTyping'); }
        if (!base && this.typing) { base = sustained('typing'); }
        if (!base && this.inactive) { base = sustained('inactive'); }
        base ??= 'idle';

        const overlay = this.overlays.get(c.id);
        return overlay && STATE_PRIORITY[overlay.state] > STATE_PRIORITY[base] ? overlay.state : base;
    }

    private recompute() {
        if (this.disposed) { return; }
        for (const c of this.companions) {
            const state = this.computeState(c);
            if (this.getState(c.id) !== state) {
                this.effective.set(c.id, state);
                this._onDidChangeState.fire({ id: c.id, state });
            } else if (!this.effective.has(c.id)) {
                this.effective.set(c.id, state);
            }
        }
    }
}
