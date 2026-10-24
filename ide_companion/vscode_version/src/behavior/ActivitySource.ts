import * as vscode from 'vscode';
import { BehaviorEvent } from './types';

/** Document schemes where edits can be the user typing (excludes output, git, debug consoles, …). */
export const TYPING_SCHEMES = new Set(['file', 'untitled', 'vscode-notebook-cell', 'vscode-remote', 'vscode-userdata']);

/** Minimum time between two 'activity' events; typing is never throttled. */
export const ACTIVITY_THROTTLE_MS = 1000;

type Position = { line: number };
type Change = { range: { start: Position; end: Position }; rangeLength: number; text: string };

/**
 * Heuristic for "the user typed this": there are no more changes than
 * cursors, and every change replaces at most one line break and touches a
 * cursor line (±1 for Enter/Backspace across lines). Format Document
 * (including whole-document replacements), rename and other bulk edits fail.
 */
export function isLikelyTyping(changes: readonly Change[], cursorLines: readonly number[]): boolean {
    if (changes.length === 0 || cursorLines.length === 0 || changes.length > cursorLines.length) {
        return false;
    }
    return changes.every(c => c.range.end.line - c.range.start.line <= 1
        && cursorLines.some(line => c.range.start.line <= line + 1 && c.range.end.line >= line - 1));
}

/** Inserted characters; a pure deletion counts as one keystroke. */
export function countTypedChars(changes: readonly Change[]): number {
    return changes.reduce((sum, c) => sum + Math.max(c.text.length, c.rangeLength > 0 ? 1 : 0), 0);
}

/**
 * Translates VS Code events into BehaviorEvents. Only user-like edits in the
 * active editor count as typing; selection, scrolling, editor switches,
 * window focus/activity and webview interactions count as activity.
 */
export class ActivitySource implements vscode.Disposable {
    private disposables: vscode.Disposable[] = [];
    private lastActivity = -Infinity;

    constructor(private readonly emit: (event: BehaviorEvent) => void, private readonly now: () => number = Date.now) {
        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument(e => this.onDocumentChange(e)),
            vscode.window.onDidChangeTextEditorSelection(e => {
                if (e.kind === vscode.TextEditorSelectionChangeKind.Keyboard || e.kind === vscode.TextEditorSelectionChangeKind.Mouse) {
                    this.reportActivity();
                }
            }),
            vscode.window.onDidChangeTextEditorVisibleRanges(e => {
                if (e.textEditor === vscode.window.activeTextEditor) {
                    this.reportActivity();
                }
            }),
            vscode.window.onDidChangeActiveTextEditor(() => this.reportActivity()),
            vscode.window.onDidChangeWindowState(state => {
                if (state.focused || state.active) {
                    this.reportActivity();
                }
            })
        );
    }

    /** Also used for webview interactions (hover / drag on a companion). */
    reportActivity() {
        const now = this.now();
        if (now - this.lastActivity < ACTIVITY_THROTTLE_MS) { return; }
        this.lastActivity = now;
        this.emit({ type: 'activity', languageId: vscode.window.activeTextEditor?.document.languageId });
    }

    private onDocumentChange(e: vscode.TextDocumentChangeEvent) {
        const editor = vscode.window.activeTextEditor;
        if (!editor || e.document !== editor.document || e.contentChanges.length === 0) { return; }
        if (!TYPING_SCHEMES.has(e.document.uri.scheme)) { return; }

        if (e.reason !== undefined) {
            // Undo / Redo: the user is active, but not typing
            this.reportActivity();
            return;
        }
        if (!isLikelyTyping(e.contentChanges, editor.selections.map(s => s.active.line))) { return; }

        this.emit({ type: 'typing', chars: countTypedChars(e.contentChanges), languageId: e.document.languageId });
    }

    dispose() {
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }
}
