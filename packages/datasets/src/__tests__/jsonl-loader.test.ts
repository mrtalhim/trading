import { describe, it, expect } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { JsonlLoader } from '../loaders/jsonl.js';

const FIXTURE_DIR = resolve(import.meta.dirname, 'fixtures');

describe('JsonlLoader', () => {
  it('loads metadata from metadata.json', async () => {
    const loader = new JsonlLoader(FIXTURE_DIR);
    const meta = await loader.metadata();
    expect(meta.exchange).toBe('synthetic');
    expect(meta.pair).toBe('BTCUSDT');
    expect(meta.interval).toBe('15m');
    expect(meta.candleCount).toBe(5);
  });

  it('streams candles from candles.jsonl', async () => {
    const loader = new JsonlLoader(FIXTURE_DIR);
    const candles: {
      timestamp: number;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }[] = [];
    for await (const c of loader.candles()) {
      candles.push(c);
    }
    expect(candles).toHaveLength(5);
    expect(candles[0].timestamp).toBe(1700000000000);
    expect(candles[0].open).toBe(42000);
    expect(candles[4].close).toBe(43400);
  });

  it('candles maintain order from file', async () => {
    const loader = new JsonlLoader(FIXTURE_DIR);
    const candles: number[] = [];
    for await (const c of loader.candles()) {
      candles.push(c.timestamp);
    }
    for (let i = 1; i < candles.length; i++) {
      expect(candles[i]).toBeGreaterThan(candles[i - 1]);
    }
  });

  it('metadata is cached across calls', async () => {
    const loader = new JsonlLoader(FIXTURE_DIR);
    const meta1 = await loader.metadata();
    const meta2 = await loader.metadata();
    expect(meta1).toBe(meta2);
  });
});

describe('JsonlLoader orderbook support', () => {
  async function withOrderbookDir(books: unknown[]): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'jsonl-ob-'));
    await writeFile(
      join(dir, 'orderbook.jsonl'),
      books.map((b) => JSON.stringify(b)).join('\n') + '\n',
    );
    return dir;
  }

  it('returns the snapshot at the exact timestamp', async () => {
    const dir = await withOrderbookDir([
      {
        bids: [
          [100, 1],
          [99, 2],
        ],
        asks: [[101, 3]],
        timestamp: 1700000000000,
      },
      { bids: [[102, 1]], asks: [[103, 2]], timestamp: 1700000090000 },
    ]);
    const loader = new JsonlLoader(dir);
    const book = await loader.orderbook(1700000000000);
    expect(book?.asks).toEqual([[101, 3]]);
    expect(await loader.orderbook(1700000090000)).not.toBeNull();
  });

  it('returns null for an instant with no snapshot', async () => {
    const dir = await withOrderbookDir([
      { bids: [[100, 1]], asks: [[101, 2]], timestamp: 1700000000000 },
    ]);
    const loader = new JsonlLoader(dir);
    expect(await loader.orderbook(1700000090000)).toBeNull();
  });

  it('returns null when the dataset has no orderbook.jsonl', async () => {
    const loader = new JsonlLoader(FIXTURE_DIR);
    expect(await loader.orderbook(1700000000000)).toBeNull();
  });

  it('rejects malformed snapshots via the OrderBook schema', async () => {
    const dir = await withOrderbookDir([{ bids: 'not-a-book', asks: [], timestamp: 1 }]);
    const loader = new JsonlLoader(dir);
    await expect(loader.orderbook(1)).rejects.toThrow();
  });
});
