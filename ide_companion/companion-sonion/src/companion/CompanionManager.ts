import * as vscode from 'vscode';
import { Companion } from './Companion';

const STORAGE_KEY = 'companions';

export class CompanionManager {

    private companions: Map<string, Companion> = new Map();

    constructor(private storage?: vscode.Memento) {
        if (this.storage) {
            const saved = this.storage.get<Companion[]>(STORAGE_KEY, []);
            saved.forEach(c => this.companions.set(c.id, c));
        }
    }

    private save() {
        if (!this.storage) return;
        this.storage.update(STORAGE_KEY, Array.from(this.companions.values()));
    }

    create(companion: Companion) {
        this.companions.set(companion.id, companion);
        this.save();
    }

    update(id: string, data: Partial<Companion>) {
        const c = this.companions.get(id);
        if (!c) return;

        this.companions.set(id, { ...c, ...data });
        this.save();
    }

    delete(id: string) {
        this.companions.delete(id);
        this.save();
    }

    get(id: string) {
        return this.companions.get(id);
    }

    getAll() {
        return Array.from(this.companions.values());
    }
}