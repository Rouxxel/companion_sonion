import { Companion } from './Companion';

export class CompanionManager {

    private companions: Map<string, Companion> = new Map();

    create(companion: Companion) {
        this.companions.set(companion.id, companion);
    }

    update(id: string, data: Partial<Companion>) {
        const c = this.companions.get(id);
        if (!c) return;

        this.companions.set(id, { ...c, ...data });
    }

    delete(id: string) {
        this.companions.delete(id);
    }

    getAll() {
        return Array.from(this.companions.values());
    }
}