import { describe, it, expect } from 'vitest';
import type { Candle } from '@trading/core';
import type { Dataset, DatasetMetadata } from '../interfaces.js';
import { ReplayLoader } from '../replay/replay-loader.js';

const CANDLES: Candle[] = [
  { timestamp: 1000, open: 100, high: 110, low: 95, close: 105, volume: 50 },
  { timestamp: 2000, open: 105, high: 115, low: 100, close: 110, volume: 60 },
  { timestamp: 3000, open: 110, high: 120, low: 105, close: 115, volume: 70 },
  { timestamp: 4000, open: 115, high: 125, low: 110, close: 120, volume: 80 },
  { timestamp: 5000, open: 120, high: 130, low: 115, close: 125, volume: 90 },
];

function makeDataset(): Dataset {
  return {
    metadata: async (): Promise<DatasetMetadata> => ({
      exchange: 'test',
      pair: 'BTCUSDT',
      interval: '15m',
      timezone: 'UTC',
      source: 'test',
      start: 1000,
      end: 5000,
      candleCount: 5,
      checksum: 'test',
      includes: { candles: true, ticker: false, orderbook: false, trades: false },
    }),
    candles: async function* () {
      for (const c of CANDLES) yield c;
    },
  };
}

describe('ReplayLoader', () => {
  it('yields candles sequentially', async () => {
    const replay = new ReplayLoader(makeDataset());
    const c1 = await replay.next();
    expect(c1?.timestamp).toBe(1000);
    const c2 = await replay.next();
    expect(c2?.timestamp).toBe(2000);
  });

  it('returns null when exhausted', async () => {
    const replay = new ReplayLoader(makeDataset());
    for (let i = 0; i < 5; i++) {
      expect(await replay.next()).not.toBeNull();
    }
    expect(await replay.next()).toBeNull();
  });

  it('peek does not advance position', async () => {
    const replay = new ReplayLoader(makeDataset());
    const peeked = await replay.peek();
    expect(peeked?.timestamp).toBe(1000);
    expect(replay.index).toBe(0);
    const next = await replay.next();
    expect(next?.timestamp).toBe(1000);
    expect(replay.index).toBe(1);
  });

  it('seek jumps to correct position', async () => {
    const replay = new ReplayLoader(makeDataset());
    await replay.next(); // advance to index 1
    const found = await replay.seek(3000);
    expect(found).toBe(true);
    expect(replay.index).toBe(2);
    const c = await replay.next();
    expect(c?.timestamp).toBe(3000);
  });

  it('seek returns false if timestamp beyond end', async () => {
    const replay = new ReplayLoader(makeDataset());
    const found = await replay.seek(99999);
    expect(found).toBe(false);
  });

  it('skip advances position', async () => {
    const replay = new ReplayLoader(makeDataset());
    const skipped = await replay.skip(3);
    expect(skipped).toBe(3);
    expect(replay.index).toBe(3);
    const c = await replay.next();
    expect(c?.timestamp).toBe(4000);
  });

  it('skip does not exceed total', async () => {
    const replay = new ReplayLoader(makeDataset());
    const skipped = await replay.skip(100);
    expect(skipped).toBe(5);
    expect(replay.exhausted).toBe(true);
  });

  it('rewind resets position to 0', async () => {
    const replay = new ReplayLoader(makeDataset());
    await replay.next();
    await replay.next();
    await replay.rewind();
    expect(replay.index).toBe(0);
    const c = await replay.next();
    expect(c?.timestamp).toBe(1000);
  });

  it('total returns candle count after loading', async () => {
    const replay = new ReplayLoader(makeDataset());
    await replay.next(); // triggers load
    expect(replay.total).toBe(5);
  });

  it('all returns all candles', async () => {
    const replay = new ReplayLoader(makeDataset());
    const all = await replay.all();
    expect(all).toHaveLength(5);
    expect(all[0].timestamp).toBe(1000);
    expect(all[4].timestamp).toBe(5000);
  });
});
