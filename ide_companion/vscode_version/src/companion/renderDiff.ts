/**
 * Pure diff between two companion render lists, keyed by id.
 *
 * This function is also injected verbatim into the webview script
 * (via Function.prototype.toString), so it must stay self-contained:
 * no imports, no references to module-level values, no template literals.
 */
export function diffCompanions<T extends { id: string }>(prev: T[], next: T[]): { added: T[]; updated: T[]; removed: string[] } {
    const prevById = new Map<string, string>();
    for (const item of prev) {
        prevById.set(item.id, JSON.stringify(item));
    }

    const added: T[] = [];
    const updated: T[] = [];
    const nextIds = new Set<string>();

    for (const item of next) {
        nextIds.add(item.id);
        const before = prevById.get(item.id);
        if (before === undefined) {
            added.push(item);
        } else if (before !== JSON.stringify(item)) {
            updated.push(item);
        }
    }

    const removed: string[] = [];
    for (const item of prev) {
        if (!nextIds.has(item.id)) {
            removed.push(item.id);
        }
    }

    return { added, updated, removed };
}
