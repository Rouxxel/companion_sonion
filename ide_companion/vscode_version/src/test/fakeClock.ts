import { Clock } from '../behavior/types';

/** Deterministic clock: timers run only when advance() passes their due time. */
export class FakeClock implements Clock {
	private time = 0;
	private nextId = 1;
	private timers = new Map<number, { due: number; callback: () => void }>();

	now() { return this.time; }

	setTimeout(callback: () => void, ms: number) {
		const id = this.nextId++;
		this.timers.set(id, { due: this.time + ms, callback });
		return id;
	}

	clearTimeout(handle: unknown) {
		this.timers.delete(handle as number);
	}

	get pendingTimers() { return this.timers.size; }

	advance(ms: number) {
		const end = this.time + ms;
		for (;;) {
			let nextId: number | undefined;
			let nextDue = Infinity;
			for (const [id, t] of this.timers) {
				if (t.due <= end && t.due < nextDue) {
					nextDue = t.due;
					nextId = id;
				}
			}
			if (nextId === undefined) { break; }
			const timer = this.timers.get(nextId)!;
			this.timers.delete(nextId);
			this.time = timer.due;
			timer.callback();
		}
		this.time = end;
	}
}
