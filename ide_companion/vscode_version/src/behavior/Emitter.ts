import { Disposable } from './types';

/** Minimal event emitter (keeps src/behavior free of the vscode module). */
export class Emitter<T> {
    private listeners = new Set<(value: T) => void>();

    readonly event = (listener: (value: T) => void): Disposable => {
        this.listeners.add(listener);
        return { dispose: () => this.listeners.delete(listener) };
    };

    fire(value: T) {
        for (const listener of [...this.listeners]) {
            listener(value);
        }
    }

    dispose() {
        this.listeners.clear();
    }
}
