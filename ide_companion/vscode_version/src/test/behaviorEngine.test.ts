import * as assert from 'assert';
import { BehaviorEngine } from '../behavior/BehaviorEngine';
import { BUILTIN_PROFILES, resolveProfiles, validateProfiles } from '../behavior/profiles';
import { BehaviorConfig, BehaviorEvent, EngineCompanion, StateChange } from '../behavior/types';
import { FakeClock } from './fakeClock';

const CONFIG: Partial<BehaviorConfig> = {
	sleepAfterSeconds: 60,
	typingCooldownMs: 1500,
	excitedCharsPerSecond: 8,
	reactionDurationMs: 3000
};

function setup(config: Partial<BehaviorConfig> = {}, companions: EngineCompanion[] = [{ id: 'a' }]) {
	const clock = new FakeClock();
	const engine = new BehaviorEngine({ ...CONFIG, ...config }, clock);
	const changes: StateChange[] = [];
	engine.onDidChangeState(c => changes.push(c));
	engine.setCompanions(companions);
	const type = (chars = 1, languageId = 'typescript') => engine.handle({ type: 'typing', chars, languageId });
	const send = (event: BehaviorEvent) => engine.handle(event);
	return { clock, engine, changes, type, send };
}

suite('BehaviorEngine — typing', () => {
	test('typing → typing; cooldown without input → idle', () => {
		const { clock, engine, type } = setup();
		type();
		assert.strictEqual(engine.getState('a'), 'typing');

		clock.advance(1000);
		type();
		clock.advance(1499);
		assert.strictEqual(engine.getState('a'), 'typing', 'cooldown restarts on each keystroke');

		clock.advance(1);
		assert.strictEqual(engine.getState('a'), 'idle');
	});

	test('sustained typing rate at or above the threshold → excited', () => {
		const { clock, engine, type } = setup();
		for (let i = 0; i < 30; i++) {
			type(1);
			clock.advance(100); // 10 chars/s
		}
		assert.strictEqual(engine.getState('a'), 'excited');

		clock.advance(1500);
		assert.strictEqual(engine.getState('a'), 'idle');
	});

	test('slow typing stays typing', () => {
		const { clock, engine, type } = setup();
		for (let i = 0; i < 30; i++) {
			type(1);
			clock.advance(250); // 4 chars/s
		}
		assert.strictEqual(engine.getState('a'), 'typing');
	});

	test('a single 500-char paste does not trigger excited', () => {
		const { engine, type } = setup();
		type(500);
		assert.strictEqual(engine.getState('a'), 'typing');
	});

	test('excitedCharsPerSecond = 0 disables excited', () => {
		const { clock, engine, type } = setup({ excitedCharsPerSecond: 0 });
		for (let i = 0; i < 50; i++) {
			type(20);
			clock.advance(50);
		}
		assert.strictEqual(engine.getState('a'), 'typing');
	});

	test('1,000 keystrokes emit at most 3 transitions', () => {
		const { clock, changes, type } = setup();
		for (let i = 0; i < 1000; i++) {
			type(1);
			clock.advance(100);
		}
		clock.advance(2000);
		assert.ok(changes.length <= 3, `got ${changes.length}: ${changes.map(c => c.state).join(' → ')}`);
		assert.deepStrictEqual(changes.map(c => c.state), ['typing', 'excited', 'idle']);
	});
});

suite('BehaviorEngine — inactivity', () => {
	test('no events for sleepAfterSeconds → sleeping; activity → idle', () => {
		const { clock, engine, send } = setup();
		clock.advance(59_999);
		assert.strictEqual(engine.getState('a'), 'idle');
		clock.advance(1);
		assert.strictEqual(engine.getState('a'), 'sleeping');

		send({ type: 'activity' });
		assert.strictEqual(engine.getState('a'), 'idle');
	});

	test('activity and typing reset the inactivity timer (no fixed interval)', () => {
		const { clock, engine, send, type } = setup();
		clock.advance(50_000);
		send({ type: 'activity' });
		clock.advance(50_000);
		type();
		clock.advance(50_000);
		assert.notStrictEqual(engine.getState('a'), 'sleeping');
		clock.advance(10_000);
		assert.strictEqual(engine.getState('a'), 'sleeping');
	});

	test('typing wakes a sleeping companion', () => {
		const { clock, engine, type } = setup();
		clock.advance(60_000);
		type();
		assert.strictEqual(engine.getState('a'), 'typing');
	});

	test('activity does not interrupt typing', () => {
		const { engine, send, type } = setup();
		type();
		send({ type: 'activity' });
		assert.strictEqual(engine.getState('a'), 'typing');
	});
});

suite('BehaviorEngine — reactions', () => {
	test('errorAppeared during typing → reacting for reactionDurationMs, then back to typing', () => {
		const { clock, engine, send, type } = setup({ typingCooldownMs: 10_000 });
		type();
		send({ type: 'errorAppeared' });
		assert.strictEqual(engine.getState('a'), 'reacting');

		clock.advance(2999);
		assert.strictEqual(engine.getState('a'), 'reacting');
		clock.advance(1);
		assert.strictEqual(engine.getState('a'), 'typing');
	});

	test('reacting returns to idle when typing already stopped', () => {
		const { clock, engine, send, type } = setup();
		type();
		send({ type: 'errorAppeared' });
		clock.advance(3000);
		assert.strictEqual(engine.getState('a'), 'idle');
	});

	test('reactToErrors = false ignores errors', () => {
		const { engine, send } = setup({ reactToErrors: false });
		send({ type: 'errorAppeared' });
		assert.strictEqual(engine.getState('a'), 'idle');
	});

	test('coder-pet: errorsCleared → excited for 2 s', () => {
		const { clock, engine, send } = setup({}, [{ id: 'a', behaviorProfile: 'coder-pet' }]);
		send({ type: 'errorsCleared' });
		assert.strictEqual(engine.getState('a'), 'excited');
		clock.advance(2000);
		assert.strictEqual(engine.getState('a'), 'idle');
	});

	test('a lower-priority time-boxed state does not override the base state', () => {
		const profiles = [{ name: 'p', rules: [{ on: 'typing' as const, state: 'typing' as const }, { on: 'activity' as const, state: 'idle' as const }] }];
		const { engine, send, type } = setup({ profiles, defaultProfile: 'p' });
		type();
		send({ type: 'activity' });
		assert.strictEqual(engine.getState('a'), 'typing');
	});
});

suite('BehaviorEngine — profiles', () => {
	test('calm ignores typing but still sleeps; none stays idle', () => {
		const { clock, engine, type } = setup({}, [{ id: 'calm', behaviorProfile: 'calm' }, { id: 'none', behaviorProfile: 'none' }]);
		type();
		assert.strictEqual(engine.getState('calm'), 'idle');
		assert.strictEqual(engine.getState('none'), 'idle');

		clock.advance(60_000);
		assert.strictEqual(engine.getState('calm'), 'sleeping');
		assert.strictEqual(engine.getState('none'), 'idle');
	});

	test('companions with different profiles react independently', () => {
		const { engine, type } = setup({}, [{ id: 'a' }, { id: 'b', behaviorProfile: 'calm' }]);
		type();
		assert.strictEqual(engine.getState('a'), 'typing');
		assert.strictEqual(engine.getState('b'), 'idle');
	});

	test('language-filtered rule only fires for a matching languageId', () => {
		const profiles = [{ name: 'py', rules: [{ on: 'typing' as const, state: 'excited' as const, when: { languageId: ['python'] } }, { on: 'typing' as const, state: 'typing' as const }] }];
		const { clock, engine, type } = setup({ profiles, defaultProfile: 'py' });

		type(1, 'typescript');
		assert.strictEqual(engine.getState('a'), 'typing');
		clock.advance(2000);

		type(1, 'python');
		assert.strictEqual(engine.getState('a'), 'excited');
	});

	test('unknown profile falls back to the default profile', () => {
		const { engine, type } = setup({}, [{ id: 'a', behaviorProfile: 'does-not-exist' }]);
		type();
		assert.strictEqual(engine.getState('a'), 'typing');
	});

	test('user profile with a built-in name overrides it', () => {
		const map = resolveProfiles([{ name: 'calm', rules: [] }]);
		assert.deepStrictEqual(map.get('calm')?.rules, []);
		assert.strictEqual(map.size, BUILTIN_PROFILES.length);
	});
});

suite('BehaviorEngine — lifecycle', () => {
	test('disabling pins every companion to idle and stops timers', () => {
		const { clock, engine, type } = setup();
		type();
		engine.updateConfig({ enabled: false });
		assert.strictEqual(engine.getState('a'), 'idle');
		assert.strictEqual(clock.pendingTimers, 0);

		type();
		clock.advance(120_000);
		assert.strictEqual(engine.getState('a'), 'idle');

		engine.updateConfig({ enabled: true });
		clock.advance(60_000);
		assert.strictEqual(engine.getState('a'), 'sleeping');
	});

	test('removed companions are dropped without an event', () => {
		const { engine, changes, type } = setup({}, [{ id: 'a' }, { id: 'b' }]);
		engine.setCompanions([{ id: 'a' }]);
		type();
		assert.deepStrictEqual(changes, [{ id: 'a', state: 'typing' }]);
	});

	test('dispose clears all timers and stops emitting', () => {
		const { clock, engine, changes, type, send } = setup();
		type();
		send({ type: 'errorAppeared' });
		const before = changes.length;
		engine.dispose();
		assert.strictEqual(clock.pendingTimers, 0);
		clock.advance(120_000);
		type();
		assert.strictEqual(changes.length, before);
	});
});

suite('validateProfiles', () => {
	test('valid profiles pass through', () => {
		const raw = [{ name: 'ts-only', rules: [{ on: 'typing', state: 'typing', when: { languageId: ['typescript'] } }, { on: 'errorsCleared', state: 'excited', durationMs: 1500 }] }];
		const result = validateProfiles(raw);
		assert.deepStrictEqual(result.errors, []);
		assert.deepStrictEqual(result.profiles, raw);
	});

	test('invalid profiles are reported by name and skipped', () => {
		const result = validateProfiles([
			{ name: 'good', rules: [] },
			{ name: 'bad-event', rules: [{ on: 'dancing', state: 'typing' }] },
			{ name: 'bad-state', rules: [{ on: 'typing', state: 'happy' }] },
			{ name: 'bad-duration', rules: [{ on: 'activity', state: 'excited', durationMs: -1 }] },
			{ name: 'bad-when', rules: [{ on: 'typing', state: 'typing', when: { languageId: 'python' } }] },
			{ rules: [] },
			{ name: 'no-rules' }
		]);
		assert.deepStrictEqual(result.profiles.map(p => p.name), ['good']);
		assert.strictEqual(result.errors.length, 6);
		assert.ok(result.errors[0].includes('"bad-event"') && result.errors[0].includes('dancing'));
	});

	test('missing or non-list input', () => {
		assert.deepStrictEqual(validateProfiles(undefined), { profiles: [], errors: [] });
		assert.strictEqual(validateProfiles({}).errors.length, 1);
	});
});
