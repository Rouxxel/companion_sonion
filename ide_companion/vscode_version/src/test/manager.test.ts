import * as assert from 'assert';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { CompanionManager } from '../companion/CompanionManager';
import { Companion } from '../companion/Companion';
import { RuntimeStates } from '../companion/RuntimeStates';
import { BehaviorEngine } from '../behavior/BehaviorEngine';
import { FakeClock } from './fakeClock';

/** In-memory Memento that counts writes. */
class FakeMemento implements vscode.Memento {
	private data = new Map<string, unknown>();
	writes = 0;

	keys() { return [...this.data.keys()]; }

	get<T>(key: string, defaultValue?: T): T {
		return (this.data.has(key) ? structuredClone(this.data.get(key)) : defaultValue) as T;
	}

	async update(key: string, value: unknown) {
		this.writes++;
		this.data.set(key, structuredClone(value));
	}
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0));
const tmpFile = (name: string) => vscode.Uri.file(path.join(os.tmpdir(), `companion-sonion-test-${process.pid}-${name}`));

async function writeJson(name: string, value: unknown) {
	const uri = tmpFile(name);
	await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value)));
	return uri;
}

const companion = (id: string, extra: Partial<Companion> = {}): Companion =>
	({ id, x: 0.5, y: 0.5, size: 180, assetPath: 'https://example.com/a.gif', locked: false, ...extra });

// Shape written by exportWorld in 0.2.3
const V023_EXPORT = [
	{ id: '1729760000000', x: 0.4, y: 0.4, size: 180, assetPath: 'https://c.tenor.com/Wqi3Xrnz2wwAAAAd/tenor.gif', locked: false, renderMode: 'panel' },
	{ id: '1729760000001', x: 0.04, y: 0.76, size: 120, assetPath: 'local:1729760000001.gif', locked: true, renderMode: 'explorer' }
];

suite('CompanionManager — import / export / profiles', () => {
	const created: vscode.Uri[] = [];

	suiteTeardown(async () => {
		for (const uri of created) {
			await vscode.workspace.fs.delete(uri).then(undefined, () => undefined);
		}
	});

	test('imports a 0.2.3 export unchanged', async () => {
		const uri = await writeJson('v023.json', V023_EXPORT);
		created.push(uri);
		const manager = new CompanionManager(new FakeMemento());

		const result = await manager.importWorld(uri.fsPath);

		assert.deepStrictEqual(result, { companions: V023_EXPORT, skipped: 0 });
		assert.deepStrictEqual(manager.getAll(), V023_EXPORT);
	});

	test('export → import round-trips stateAssets and behaviorProfile', async () => {
		const source = new CompanionManager(new FakeMemento());
		source.create(companion('a', { stateAssets: { typing: 'https://example.com/t.gif', sleeping: 'local:1.webm' }, behaviorProfile: 'calm' }));
		source.create(companion('b', { renderMode: 'explorer' }));
		await flush();

		const uri = tmpFile('roundtrip.json');
		created.push(uri);
		await source.exportWorld(uri.fsPath);

		const target = new CompanionManager(new FakeMemento());
		const result = await target.importWorld(uri.fsPath);
		assert.strictEqual(result.skipped, 0);
		assert.deepStrictEqual(target.getAll(), source.getAll());
	});

	test('malformed entries are skipped and counted', async () => {
		const uri = await writeJson('malformed.json', [V023_EXPORT[0], { id: 'x' }, null, 'nope']);
		created.push(uri);
		const manager = new CompanionManager(new FakeMemento());

		const result = await manager.importWorld(uri.fsPath);
		assert.strictEqual(result.companions.length, 1);
		assert.strictEqual(result.skipped, 3);
	});

	test('an invalid file throws and leaves current companions untouched', async () => {
		const manager = new CompanionManager(new FakeMemento());
		manager.create(companion('keep'));
		await flush();

		for (const [name, content] of [['not-json.json', '{oops'], ['not-array.json', { companions: [] }]] as const) {
			const uri = await writeJson(name, content);
			created.push(uri);
			await assert.rejects(manager.importWorld(uri.fsPath));
			assert.deepStrictEqual(manager.getAll().map(c => c.id), ['keep']);
		}
	});

	test('profiles save and load through validation', async () => {
		const manager = new CompanionManager(new FakeMemento());
		manager.create(companion('a', { behaviorProfile: 'coder-pet' }));
		await flush();
		await manager.saveProfile('work');

		manager.delete('a');
		manager.create(companion('b'));
		await flush();

		const result = await manager.loadProfile('work');
		assert.deepStrictEqual(result?.skipped, 0);
		assert.deepStrictEqual(manager.getAll(), [companion('a', { behaviorProfile: 'coder-pet' })]);
		assert.deepStrictEqual(manager.listProfiles(), ['work']);
	});

	test('change events name the affected companion; bulk loads affect all', async () => {
		const manager = new CompanionManager(new FakeMemento());
		const changes: (string[] | undefined)[] = [];
		manager.onDidChange(c => changes.push(c.ids));

		manager.create(companion('a'));
		await flush();
		manager.update('a', { size: 200 });
		await flush();
		await manager.saveProfile('p');
		await manager.loadProfile('p');

		assert.deepStrictEqual(changes, [['a'], ['a'], undefined]);
	});
});

suite('Performance — reactions never touch storage', () => {
	test('60 s of typing with 10 companions: 0 storage writes, 0 full renders, few state messages', async () => {
		const memento = new FakeMemento();
		const manager = new CompanionManager(memento);
		for (let i = 0; i < 10; i++) {
			manager.create(companion(`c${i}`, { renderMode: i % 2 ? 'explorer' : 'panel' }));
		}
		await flush();

		const clock = new FakeClock();
		const states = new RuntimeStates();
		const engine = new BehaviorEngine({}, clock);
		engine.onDidChangeState(({ id, state }) => states.set(id, state));
		engine.setCompanions(manager.getAll());

		const writesBefore = memento.writes;
		let managerChanges = 0;
		let stateMessages = 0;
		manager.onDidChange(() => managerChanges++);
		states.onDidChange(() => stateMessages++);

		// 60 s at 10 chars/s, then stop
		for (let i = 0; i < 600; i++) {
			engine.handle({ type: 'typing', chars: 1, languageId: 'typescript' });
			clock.advance(100);
		}
		clock.advance(2000);
		await flush();

		assert.strictEqual(memento.writes - writesBefore, 0, 'no globalState writes');
		assert.strictEqual(managerChanges, 0, 'no full re-renders');
		assert.strictEqual(stateMessages, 30, 'typing → excited → idle for each of the 10 companions');

		engine.dispose();
		states.dispose();
	});
});
