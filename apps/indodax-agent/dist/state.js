import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
export function freshState(ownerId) {
    return {
        ownerId,
        seq: 0,
        position: 0,
        avgEntry: 0,
        realizedPnl: 0,
        spentIdr: 0,
        tradesThisHour: 0,
        dailyLoss: 0,
        openOrders: [],
    };
}
const EVENTS_FILE = 'events.jsonl';
const SNAPSHOT_FILE = 'state.json';
export class StateStore {
    dir;
    ownerId;
    constructor(dir, ownerId) {
        this.dir = dir;
        this.ownerId = ownerId;
    }
    eventsPath() {
        return join(this.dir, EVENTS_FILE);
    }
    snapshotPath() {
        return join(this.dir, SNAPSHOT_FILE);
    }
    async load() {
        try {
            const raw = JSON.parse(await readFile(this.snapshotPath(), 'utf8'));
            const base = freshState(this.ownerId);
            if (raw.ownerId !== this.ownerId)
                return base;
            return {
                ownerId: this.ownerId,
                seq: raw.seq ?? 0,
                position: raw.position ?? 0,
                avgEntry: raw.avgEntry ?? 0,
                realizedPnl: raw.realizedPnl ?? 0,
                spentIdr: raw.spentIdr ?? 0,
                tradesThisHour: raw.tradesThisHour ?? 0,
                dailyLoss: raw.dailyLoss ?? 0,
                openOrders: raw.openOrders ?? [],
            };
        }
        catch {
            return freshState(this.ownerId);
        }
    }
    async append(event) {
        await mkdir(this.dir, { recursive: true });
        const line = JSON.stringify(event) + '\n';
        const prev = await readFile(this.eventsPath(), 'utf8').catch(() => '');
        await writeFile(this.eventsPath(), prev + line);
    }
    async snapshot(state) {
        await mkdir(this.dir, { recursive: true });
        const tmp = join(this.dir, `${SNAPSHOT_FILE}.tmp`);
        await writeFile(tmp, JSON.stringify(state, null, 2));
        await rename(tmp, this.snapshotPath());
    }
    async *events() {
        const raw = await readFile(this.eventsPath(), 'utf8').catch(() => '');
        for (const line of raw.split('\n')) {
            if (line.trim() === '')
                continue;
            yield JSON.parse(line);
        }
    }
}
//# sourceMappingURL=state.js.map