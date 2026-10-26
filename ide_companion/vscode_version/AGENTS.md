# Agent notes — Companion Sonion (VS Code extension)

Run everything from `ide_companion/vscode_version`.

## Verify

- `npm run compile` — TypeScript build to `out/`
- `npm run lint` — ESLint (keep at 0 warnings; style: `if (x) { return; }`)
- `npm test` — runs compile + lint first, then all `out/test/**/*.test.js` inside downloaded VS Code builds (`.vscode-test/`, git-ignored, first run downloads them): the latest stable **and** 1.105.1 (Cursor's VS Code base), see `.vscode-test.mjs`
  - VS Code < 1.101 can't run the ESM-only mocha used by the runner (`overrides` in package.json), so the 1.89 minimum is checked at compile time only
  - Mocha TDD UI (`suite` / `test`), default timeout 2 s; use `async function () { this.timeout(...) }` for slow extension-host tests
  - Shared test helpers without `.test` in the name (e.g. `src/test/fakeClock.ts`)
- `npx @vscode/vsce ls` — files that go into the VSIX; `npx @vscode/vsce package` — builds `companion-sonion-<version>.vsix` (git-ignored)

## Compatibility (VS Code forks)

- `engines.vscode` is `^1.89.0` (oldest version with every API used; `WindowState.active` is the newest one). Cursor, Kiro, Antigravity etc. lag behind upstream VS Code and hide/refuse extensions whose minimum is higher than their base
- `@types/vscode` is pinned to exactly `1.89.0` so the compiler rejects newer APIs; raise both together, and only when a newer API is really needed (vsce also requires types ≤ engines)
- Forks install from Open VSX, not the VS Code Marketplace

## Layout

- `src/companion/` — data model, persisted state (`CompanionManager`), runtime state (`RuntimeStates`, never persisted), renderers (Panel / Explorer) sharing `companionView.ts`, webview HTML/JS in `companionHtml.ts` (`renderDiff.ts` is injected into it via `toString()` — keep it self-contained)
- `src/behavior/` — `BehaviorEngine.ts`, `profiles.ts`, `types.ts`, `Emitter.ts` must not import `vscode` (pure, fake-clock tested); `ActivitySource.ts` and `config.ts` are the VS Code adapters
- Panel restore after reload: `registerWebviewPanelSerializer('companionPanel')` in `extension.ts` + `onWebviewPanel:companionPanel` in `activationEvents` (keep both in sync with `CompanionPanel.viewType`)
- User-facing changes: update `README.md` and `CHANGELOG.md` `[Unreleased]` in the same change
