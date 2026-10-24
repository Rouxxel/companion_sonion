import * as assert from 'assert';
import { diffCompanions } from '../companion/renderDiff';
import { getAssetKind } from '../companion/companionView';
import { getCompanionHtml } from '../companion/companionHtml';

const item = (id: string, extra: Record<string, unknown> = {}) => ({ id, x: 0.5, y: 0.5, size: 180, assetPath: 'a.gif', ...extra });

suite('diffCompanions', () => {
	test('detects added, updated and removed items by id', () => {
		const prev = [item('1'), item('2'), item('3')];
		const next = [item('1'), item('2', { x: 0.1 }), item('4')];

		const diff = diffCompanions(prev, next);

		assert.deepStrictEqual(diff.added.map(c => c.id), ['4']);
		assert.deepStrictEqual(diff.updated.map(c => c.id), ['2']);
		assert.deepStrictEqual(diff.removed, ['3']);
	});

	test('unchanged items are not reported', () => {
		const diff = diffCompanions([item('1'), item('2')], [item('1'), item('2')]);
		assert.deepStrictEqual(diff, { added: [], updated: [], removed: [] });
	});

	test('a change in any field (asset, lock, state) counts as an update', () => {
		const prev = [item('1'), item('2'), item('3')];
		const next = [item('1', { assetPath: 'b.webm' }), item('2', { locked: true }), item('3', { state: 'typing' })];
		assert.deepStrictEqual(diffCompanions(prev, next).updated.map(c => c.id), ['1', '2', '3']);
	});

	test('empty lists', () => {
		assert.deepStrictEqual(diffCompanions([], [item('1')]).added.map(c => c.id), ['1']);
		assert.deepStrictEqual(diffCompanions([item('1')], []).removed, ['1']);
	});

	test('is self-contained so it can be injected into the webview', () => {
		const injected = new Function(`return (${diffCompanions.toString()});`)();
		const diff = injected([item('1')], [item('1', { size: 200 }), item('2')]);
		assert.deepStrictEqual(diff.updated.map((c: { id: string }) => c.id), ['1']);
		assert.deepStrictEqual(diff.added.map((c: { id: string }) => c.id), ['2']);
	});
});

suite('getAssetKind', () => {
	test('video extensions', () => {
		assert.strictEqual(getAssetKind('local:123.webm'), 'video');
		assert.strictEqual(getAssetKind('https://example.com/clip.MP4'), 'video');
		assert.strictEqual(getAssetKind('https://example.com/clip.webm?raw=true#t=1'), 'video');
	});

	test('everything else is an image', () => {
		assert.strictEqual(getAssetKind('https://c.tenor.com/abc/tenor.gif'), 'image');
		assert.strictEqual(getAssetKind('local:123.png'), 'image');
		assert.strictEqual(getAssetKind('https://example.com/no-extension'), 'image');
		assert.strictEqual(getAssetKind('https://example.com/webm/file.gif'), 'image');
		assert.strictEqual(getAssetKind(''), 'image');
	});
});

suite('getCompanionHtml', () => {
	for (const mode of ['panel', 'explorer'] as const) {
		test(`${mode} webview script is valid JavaScript`, () => {
			const html = getCompanionHtml(mode);
			const match = html.match(/<script>([\s\S]*)<\/script>/);
			assert.ok(match, 'script block found');
			assert.doesNotThrow(() => new Function(match[1]));
		});
	}
});
