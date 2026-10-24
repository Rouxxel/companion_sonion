import { defineConfig } from '@vscode/test-cli';

// Run the suite on the latest VS Code and on the VS Code version Cursor ships
// (VS Code forks lag behind upstream). The API minimum (engines.vscode ^1.89.0) is
// enforced at compile time by the pinned @types/vscode; VS Code < 1.101 can't run the
// ESM-only mocha used by the test runner, so the runtime check uses 1.105.1.
export default defineConfig([
	{
		label: 'stable',
		files: 'out/test/**/*.test.js',
	},
	{
		label: 'cursor-base',
		version: '1.105.1',
		files: 'out/test/**/*.test.js',
	},
]);
