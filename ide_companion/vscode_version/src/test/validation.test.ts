import * as assert from 'assert';
import { validateCompanion, validateCompanions } from '../companion/validation';
import { RuntimeStates } from '../companion/RuntimeStates';

// Shape written by exportWorld in 0.2.3
const v023Export = [
	{ id: '1729760000000', x: 0.4, y: 0.4, size: 180, assetPath: 'https://c.tenor.com/Wqi3Xrnz2wwAAAAd/tenor.gif', locked: false, renderMode: 'panel' },
	{ id: '1729760000001', x: 0.04, y: 0.76, size: 120, assetPath: 'local:1729760000001.gif', locked: true, renderMode: 'explorer' },
	{ id: '1729760000002', x: 0.5, y: 0.5, size: 180, assetPath: 'https://example.com/a.png', locked: false }
];

suite('validateCompanions', () => {
	test('0.2.3 exports load unchanged', () => {
		const result = validateCompanions(v023Export);
		assert.strictEqual(result.skipped, 0);
		assert.deepStrictEqual(result.companions, v023Export);
	});

	test('stateAssets and behaviorProfile round-trip through JSON', () => {
		const withStates = [{ ...v023Export[0], stateAssets: { typing: 'https://example.com/t.gif', sleeping: 'local:9.webm' }, behaviorProfile: 'calm' }];
		const result = validateCompanions(JSON.parse(JSON.stringify(withStates)));
		assert.strictEqual(result.skipped, 0);
		assert.deepStrictEqual(result.companions, withStates);
	});

	test('malformed entries are skipped, not fatal', () => {
		const result = validateCompanions([
			v023Export[0],
			null,
			'nope',
			{ id: '', x: 0, y: 0, size: 100, assetPath: 'a.gif' },
			{ id: 'no-asset', x: 0, y: 0, size: 100 },
			{ id: 'bad-x', x: 'left', y: 0, size: 100, assetPath: 'a.gif' },
			{ id: 'nan-size', x: 0, y: 0, size: NaN, assetPath: 'a.gif' }
		]);
		assert.strictEqual(result.companions.length, 1);
		assert.strictEqual(result.skipped, 6);
	});

	test('duplicate ids keep the first entry', () => {
		const result = validateCompanions([v023Export[0], { ...v023Export[0], size: 99 }]);
		assert.strictEqual(result.companions.length, 1);
		assert.strictEqual(result.companions[0].size, 180);
		assert.strictEqual(result.skipped, 1);
	});

	test('non-array input throws', () => {
		assert.throws(() => validateCompanions({ companions: [] }), /array/);
	});
});

suite('validateCompanion', () => {
	test('clamps position and size to the mode limits', () => {
		const panel = validateCompanion({ id: 'a', x: -0.5, y: 3, size: 5, assetPath: 'a.gif' });
		assert.deepStrictEqual([panel?.x, panel?.y, panel?.size], [0, 1, 40]);

		const explorer = validateCompanion({ id: 'b', x: 0.5, y: 0.5, size: 999, assetPath: 'a.gif', renderMode: 'explorer' });
		assert.strictEqual(explorer?.size, 200);
	});

	test('normalizes optional fields', () => {
		const c = validateCompanion({
			id: 42, x: 0.1, y: 0.2, size: 100, assetPath: 'a.gif',
			locked: 'yes', renderMode: 'floating', behaviorProfile: '',
			stateAssets: { typing: 't.gif', idle: 'i.gif', dancing: 'd.gif', sleeping: '' }
		});
		assert.deepStrictEqual(c, { id: '42', x: 0.1, y: 0.2, size: 100, assetPath: 'a.gif', locked: false, stateAssets: { typing: 't.gif' } });
	});

	test('drops stateAssets when no valid state remains', () => {
		const c = validateCompanion({ id: 'a', x: 0, y: 0, size: 100, assetPath: 'a.gif', stateAssets: { idle: 'i.gif' } });
		assert.strictEqual(c?.stateAssets, undefined);
	});
});

suite('RuntimeStates', () => {
	test('defaults to idle and fires only on changes', () => {
		const states = new RuntimeStates();
		const events: string[] = [];
		states.onDidChange(e => events.push(`${e.id}:${e.state}`));

		assert.strictEqual(states.get('a'), 'idle');
		states.set('a', 'typing');
		states.set('a', 'typing');
		states.set('a', 'idle');
		states.set('a', 'idle');

		assert.deepStrictEqual(events, ['a:typing', 'a:idle']);
		states.dispose();
	});

	test('retain drops states of removed companions', () => {
		const states = new RuntimeStates();
		states.set('a', 'sleeping');
		states.set('b', 'typing');
		states.retain(['b']);
		assert.strictEqual(states.get('a'), 'idle');
		assert.strictEqual(states.get('b'), 'typing');
		states.dispose();
	});
});
