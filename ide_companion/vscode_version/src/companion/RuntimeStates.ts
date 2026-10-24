import * as vscode from 'vscode';
import { CompanionState } from './Companion';

/**
 * In-memory animation state per companion. Never persisted: changes here
 * do not touch globalState, profiles or exports, and renderers forward them
 * to the webview as lightweight 'state' messages instead of full renders.
 */
export class RuntimeStates implements vscode.Disposable {
    private states = new Map<string, CompanionState>();
    private _onDidChange = new vscode.EventEmitter<{ id: string; state: CompanionState }>();
    public readonly onDidChange = this._onDidChange.event;

    get(id: string): CompanionState {
        return this.states.get(id) ?? 'idle';
    }

    set(id: string, state: CompanionState) {
        if (this.get(id) === state) { return; }
        if (state === 'idle') {
            this.states.delete(id);
        } else {
            this.states.set(id, state);
        }
        this._onDidChange.fire({ id, state });
    }

    /** Drops states of companions that no longer exist. */
    retain(ids: Iterable<string>) {
        const keep = new Set(ids);
        for (const id of [...this.states.keys()]) {
            if (!keep.has(id)) {
                this.states.delete(id);
            }
        }
    }

    dispose() {
        this._onDidChange.dispose();
    }
}
