import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  StateStore,
  type AgentState,
  type StateEvent,
} from '../../apps/indodax-agent/src/state.js';

let dir = '';

async function setup(): Promise<string> {
  dir = await mkdtemp(join(tmpdir(), 'state-'));
  return dir;
}

afterEach(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
});

describe('StateStore', () => {
  it('loads a fresh default state when nothing is persisted', async () => {
    const d = await setup();
    const store = new StateStore(d, 'abc123');
    const state = await store.load();
    expect(state.ownerId).toBe('abc123');
    expect(state.seq).toBe(0);
    expect(state.position).toBe(0);
    expect(state.openOrders).toEqual([]);
  });

  it('round-trips events through JSONL', async () => {
    const d = await setup();
    const store = new StateStore(d, 'abc123');
    await store.append({ ts: 100, type: 'trade', trade: { id: 'AG-abc123-1' } });
    await store.append({ ts: 200, type: 'reconcile', position: 0.5 });
    const events: StateEvent[] = [];
    for await (const e of store.events()) events.push(e);
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe('trade');
    expect(events[1]).toMatchObject({ type: 'reconcile', position: 0.5 });
  });

  it('snapshot + load round-trips persisted agent state', async () => {
    const d = await setup();
    const store = new StateStore(d, 'abc123');
    await store.snapshot({
      ownerId: 'abc123',
      seq: 5,
      position: 2,
      avgEntry: 100,
      realizedPnl: 12.5,
      spentIdr: 900_000,
      openOrders: [{ clientOrderId: 'AG-abc123-1' }],
    });
    const reloaded = new StateStore(d, 'abc123');
    const state = await reloaded.load();
    expect(state.seq).toBe(5);
    expect(state.position).toBe(2);
    expect(state.realizedPnl).toBe(12.5);
    expect(state.openOrders).toEqual([{ clientOrderId: 'AG-abc123-1' }]);
  });

  it('isolation between two agents in the same dir', async () => {
    const d = await setup();
    const a = new StateStore(d, 'aaa');
    await a.snapshot({ ownerId: 'aaa', seq: 1 });
    const b = new StateStore(d, 'bbb');
    const bState = await b.load();
    expect(bState.ownerId).toBe('bbb');
    expect(bState.seq).toBe(0);
  });
});
