import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';

const EXTENSION_ID = 'Rouxxel.companion-sonion';

suite('Extension Test Suite', () => {
	suiteSetup(async () => {
		const extension = vscode.extensions.getExtension(EXTENSION_ID);
		assert.ok(extension, `${EXTENSION_ID} is installed in the test host`);
		await extension.activate();
	});

	test('every contributed command is registered', async () => {
		const extension = vscode.extensions.getExtension(EXTENSION_ID)!;
		const contributed: { command: string }[] = extension.packageJSON.contributes.commands;
		const registered = new Set(await vscode.commands.getCommands(true));

		const missing = contributed.map(c => c.command).filter(c => !registered.has(c));
		assert.deepStrictEqual(missing, []);
	});

	test('toggling reactions updates the setting without errors', async () => {
		const settings = () => vscode.workspace.getConfiguration('companion.behavior');
		const before = settings().inspect<boolean>('enabled')?.globalValue;
		try {
			await vscode.commands.executeCommand('companion.toggleBehavior');
			assert.strictEqual(settings().get('enabled'), false);
			await vscode.commands.executeCommand('companion.toggleBehavior');
			assert.strictEqual(settings().get('enabled'), true);
		} finally {
			await settings().update('enabled', before, vscode.ConfigurationTarget.Global);
		}
	});
});
