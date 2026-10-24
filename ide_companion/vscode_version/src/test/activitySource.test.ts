import * as assert from 'assert';
import * as vscode from 'vscode';
import { ActivitySource, countTypedChars, isLikelyTyping } from '../behavior/ActivitySource';
import { parseBehaviorConfig } from '../behavior/config';
import { BehaviorConfig, BehaviorEvent, DEFAULT_BEHAVIOR_CONFIG } from '../behavior/types';

const change = (startLine: number, endLine: number, text: string, rangeLength = 0) =>
	({ range: { start: { line: startLine }, end: { line: endLine } }, rangeLength, text });

suite('isLikelyTyping / countTypedChars', () => {
	test('a keystroke at the cursor is typing', () => {
		assert.strictEqual(isLikelyTyping([change(5, 5, 'a')], [5]), true);
	});

	test('Enter / Backspace across a line break is typing', () => {
		assert.strictEqual(isLikelyTyping([change(5, 5, '\n    ')], [5]), true);
		assert.strictEqual(isLikelyTyping([change(4, 5, '', 1)], [5]), true);
	});

	test('one change per cursor (multi-cursor) is typing', () => {
		assert.strictEqual(isLikelyTyping([change(1, 1, 'x'), change(9, 9, 'x')], [1, 9]), true);
	});

	test('format-like edits are not typing', () => {
		assert.strictEqual(isLikelyTyping([change(1, 1, '  '), change(7, 7, '  ')], [7]), false, 'more changes than cursors');
		assert.strictEqual(isLikelyTyping([change(40, 40, ';')], [5]), false, 'far from the cursor');
		assert.strictEqual(isLikelyTyping([change(0, 120, 'formatted', 3000)], [5]), false, 'whole-document replacement');
		assert.strictEqual(isLikelyTyping([], [5]), false);
	});

	test('counts inserted characters; deletions count as one', () => {
		assert.strictEqual(countTypedChars([change(0, 0, 'abc'), change(1, 1, '', 4)]), 4);
	});
});

suite('parseBehaviorConfig', () => {
	const parse = (values: Partial<Record<keyof BehaviorConfig, unknown>>) => parseBehaviorConfig(key => values[key]);

	test('missing settings fall back to the defaults', () => {
		assert.deepStrictEqual(parse({}), { config: DEFAULT_BEHAVIOR_CONFIG, errors: [] });
	});

	test('numbers are clamped and wrong types ignored', () => {
		const { config } = parse({ sleepAfterSeconds: 1, typingCooldownMs: 'fast', excitedCharsPerSecond: -5, enabled: 'yes', defaultProfile: ' ' });
		assert.strictEqual(config.sleepAfterSeconds, 10);
		assert.strictEqual(config.typingCooldownMs, DEFAULT_BEHAVIOR_CONFIG.typingCooldownMs);
		assert.strictEqual(config.excitedCharsPerSecond, 0);
		assert.strictEqual(config.enabled, true);
		assert.strictEqual(config.defaultProfile, 'default');
	});

	test('invalid user profiles are reported and skipped', () => {
		const { config, errors } = parse({ profiles: [{ name: 'ok', rules: [] }, { name: 'bad', rules: [{ on: 'nope', state: 'typing' }] }] });
		assert.deepStrictEqual(config.profiles.map(p => p.name), ['ok']);
		assert.strictEqual(errors.length, 1);
	});
});

suite('ActivitySource (extension host)', () => {
	let events: BehaviorEvent[];
	let time: number;
	let source: ActivitySource;

	const settle = () => new Promise(resolve => setTimeout(resolve, 50));
	const typingEvents = () => events.filter(e => e.type === 'typing');

	setup(async () => {
		events = [];
		time = 0;
		source = new ActivitySource(e => events.push(e), () => time);
	});

	teardown(async () => {
		source.dispose();
		await vscode.commands.executeCommand('workbench.action.closeAllEditors');
	});

	test('an edit at the cursor in the active editor is typing', async () => {
		const doc = await vscode.workspace.openTextDocument({ content: '', language: 'typescript' });
		const editor = await vscode.window.showTextDocument(doc);
		await settle();
		events = [];

		await editor.edit(b => b.insert(editor.selection.active, 'abc'));
		await settle();

		assert.deepStrictEqual(typingEvents(), [{ type: 'typing', chars: 3, languageId: 'typescript' }]);
	});

	test('edits to a document that is not in the active editor are ignored', async () => {
		const active = await vscode.workspace.openTextDocument({ content: '' });
		await vscode.window.showTextDocument(active);
		const background = await vscode.workspace.openTextDocument({ content: 'x' });
		await settle();
		events = [];

		const edit = new vscode.WorkspaceEdit();
		edit.insert(background.uri, new vscode.Position(0, 0), 'hello');
		await vscode.workspace.applyEdit(edit);
		await settle();

		assert.deepStrictEqual(typingEvents(), []);
	});

	test('a whole-document replacement (formatter-like) is not typing', async () => {
		const doc = await vscode.workspace.openTextDocument({ content: 'a\nb\nc\nd\n' });
		const editor = await vscode.window.showTextDocument(doc);
		await settle();
		events = [];

		const all = new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length));
		await editor.edit(b => b.replace(all, 'A\nB\nC\nD\n'));
		await settle();

		assert.deepStrictEqual(typingEvents(), []);
	});

	test('undo is activity, not typing; activity is throttled', async () => {
		const doc = await vscode.workspace.openTextDocument({ content: '' });
		const editor = await vscode.window.showTextDocument(doc);
		await editor.edit(b => b.insert(editor.selection.active, 'x'));
		await settle();
		events = [];
		time = 10_000;

		await vscode.commands.executeCommand('undo');
		await settle();
		assert.deepStrictEqual(typingEvents(), []);
		assert.ok(events.some(e => e.type === 'activity'), 'undo reported as activity');

		const count = events.length;
		source.reportActivity();
		assert.strictEqual(events.length, count, 'second activity within 1 s is dropped');
		time += 1000;
		source.reportActivity();
		assert.strictEqual(events.length, count + 1);
	});
});
