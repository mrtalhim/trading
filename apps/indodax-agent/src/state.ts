import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface AgentState {
  ownerId: string;
  seq: number;
  position: number;
  avgEntry: number;
  realizedPnl: number;
  spentIdr: number;
  tradesThisHour: number;
  dailyLoss: number;
  openOrders: { clientOrderId: string; symbol: string }[];
}

export type StateEvent =
  | { ts: number; type: 'start' | 'stop' }
  | {
      ts: number;
      type: 'trade';
      trade: {
        clientOrderId: string;
        side: 'buy' | 'sell';
        quantity: number;
        price: number;
        fee: number;
        realizedPnl: number;
      };
    }
  | { ts: number; type: 'reconcile'; position: number; consistent: boolean };

export function freshState(ownerId: string): AgentState {
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
  constructor(
    private readonly dir: string,
    private readonly ownerId: string,
  ) {}

  private eventsPath(): string {
    return join(this.dir, EVENTS_FILE);
  }

  private snapshotPath(): string {
    return join(this.dir, SNAPSHOT_FILE);
  }

  async load(): Promise<AgentState> {
    try {
      const raw = JSON.parse(await readFile(this.snapshotPath(), 'utf8')) as Partial<AgentState>;
      const base = freshState(this.ownerId);
      if (raw.ownerId !== this.ownerId) return base;
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
    } catch {
      return freshState(this.ownerId);
    }
  }

  async append(event: StateEvent): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const line = JSON.stringify(event) + '\n';
    const prev = await readFile(this.eventsPath(), 'utf8').catch(() => '');
    await writeFile(this.eventsPath(), prev + line);
  }

  async snapshot(state: AgentState): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const tmp = join(this.dir, `${SNAPSHOT_FILE}.tmp`);
    await writeFile(tmp, JSON.stringify(state, null, 2));
    await rename(tmp, this.snapshotPath());
  }

  async *events(): AsyncIterable<StateEvent> {
    const raw = await readFile(this.eventsPath(), 'utf8').catch(() => '');
    for (const line of raw.split('\n')) {
      if (line.trim() === '') continue;
      yield JSON.parse(line) as StateEvent;
    }
  }
}
