import * as assert from 'assert';
import * as vscode from 'vscode';
import { ActivitySource, countTypedChars, DIAGNOSTICS_DEBOUNCE_MS, errorTransition, isLikelyTyping } from '../behavior/ActivitySource';
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

suite('errorTransition', () => {
	test('first sight of a file is a baseline, never a reaction', () => {
		assert.strictEqual(errorTransition(undefined, 5), undefined);
		assert.strictEqual(errorTransition(undefined, 0), undefined);
	});

	test('more errors → errorAppeared; down to zero → errorsCleared', () => {
		assert.strictEqual(errorTransition(0, 1), 'errorAppeared');
		assert.strictEqual(errorTransition(2, 3), 'errorAppeared');
		assert.strictEqual(errorTransition(3, 0), 'errorsCleared');
	});

	test('fewer (but not zero) or unchanged errors → nothing', () => {
		assert.strictEqual(errorTransition(3, 2), undefined);
		assert.strictEqual(errorTransition(2, 2), undefined);
		assert.strictEqual(errorTransition(0, 0), undefined);
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

	test('errors appearing / clearing in the active file are reported once, debounced', async function () {
		this.timeout(10_000); // waits for three debounce periods
		const diagnostics = vscode.languages.createDiagnosticCollection('companion-test');
		try {
			const doc = await vscode.workspace.openTextDocument({ content: 'one\ntwo\n', language: 'plaintext' });
			await vscode.window.showTextDocument(doc);
			await settle();
			events = [];

			const error = (line: number) => new vscode.Diagnostic(new vscode.Range(line, 0, line, 3), 'boom', vscode.DiagnosticSeverity.Error);
			// A burst of publishes settles into one reaction
			diagnostics.set(doc.uri, [error(0)]);
			diagnostics.set(doc.uri, [error(0), error(1)]);
			await new Promise(resolve => setTimeout(resolve, DIAGNOSTICS_DEBOUNCE_MS + 200));
			assert.deepStrictEqual(events.filter(e => e.type === 'errorAppeared'), [{ type: 'errorAppeared', languageId: 'plaintext' }]);

			// Warnings don't count
			diagnostics.set(doc.uri, [error(0), error(1), new vscode.Diagnostic(new vscode.Range(0, 0, 0, 1), 'meh', vscode.DiagnosticSeverity.Warning)]);
			await new Promise(resolve => setTimeout(resolve, DIAGNOSTICS_DEBOUNCE_MS + 200));
			assert.strictEqual(events.filter(e => e.type === 'errorAppeared').length, 1);

			diagnostics.set(doc.uri, []);
			await new Promise(resolve => setTimeout(resolve, DIAGNOSTICS_DEBOUNCE_MS + 200));
			assert.deepStrictEqual(events.filter(e => e.type === 'errorsCleared'), [{ type: 'errorsCleared', languageId: 'plaintext' }]);
		} finally {
			diagnostics.dispose();
		}
	});

	test('switching to a file that already has errors does not react', async () => {
		const diagnostics = vscode.languages.createDiagnosticCollection('companion-test');
		try {
			const first = await vscode.workspace.openTextDocument({ content: 'a' });
			await vscode.window.showTextDocument(first);
			const broken = await vscode.workspace.openTextDocument({ content: 'b' });
			diagnostics.set(broken.uri, [new vscode.Diagnostic(new vscode.Range(0, 0, 0, 1), 'boom', vscode.DiagnosticSeverity.Error)]);
			await new Promise(resolve => setTimeout(resolve, DIAGNOSTICS_DEBOUNCE_MS + 200));
			events = [];

			await vscode.window.showTextDocument(broken);
			await new Promise(resolve => setTimeout(resolve, DIAGNOSTICS_DEBOUNCE_MS + 200));
			assert.deepStrictEqual(events.filter(e => e.type === 'errorAppeared'), []);
		} finally {
			diagnostics.dispose();
		}
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
