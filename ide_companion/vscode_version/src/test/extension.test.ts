import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { CompanionPanel } from '../companion/CompanionPanel';
import { CompanionManager } from '../companion/CompanionManager';
import { RuntimeStates } from '../companion/RuntimeStates';

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

	test('extension activates on a restored companion panel', () => {
		const extension = vscode.extensions.getExtension(EXTENSION_ID)!;
		assert.ok((extension.packageJSON.activationEvents as string[]).includes(`onWebviewPanel:${CompanionPanel.viewType}`));
	});

	test('a restored panel is revived as the companion panel', () => {
		const restored = vscode.window.createWebviewPanel(CompanionPanel.viewType, 'Companion', vscode.ViewColumn.One);
		const states = new RuntimeStates();
		try {
			const revived = CompanionPanel.revive(restored, vscode.Uri.file(__dirname), new CompanionManager(), states);
			assert.strictEqual(CompanionPanel.currentPanel, revived);
			assert.strictEqual(restored.webview.options.enableScripts, true);
			assert.ok(restored.webview.html.includes('id="world"'), 'companion HTML is loaded into the restored panel');
		} finally {
			restored.dispose();
			states.dispose();
		}
		assert.strictEqual(CompanionPanel.currentPanel, undefined, 'disposing the panel clears it');
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
