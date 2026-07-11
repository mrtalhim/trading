import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
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
