import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { CsvLoader } from '../loaders/csv.js';

const FIXTURE_DIR = resolve(import.meta.dirname, 'fixtures');

describe('CsvLoader', () => {
  it('loads metadata from metadata.json', async () => {
    const loader = new CsvLoader(FIXTURE_DIR);
    const meta = await loader.metadata();
    expect(meta.exchange).toBe('synthetic');
    expect(meta.pair).toBe('BTCUSDT');
  });

  it('streams candles from candles.csv', async () => {
    const loader = new CsvLoader(FIXTURE_DIR);
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

  it('produces same data as JsonlLoader', async () => {
    const { JsonlLoader } = await import('../loaders/jsonl.js');
    const csvLoader = new CsvLoader(FIXTURE_DIR);
    const jsonlLoader = new JsonlLoader(FIXTURE_DIR);

    const csvCandles: {
      timestamp: number;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }[] = [];
    for await (const c of csvLoader.candles()) {
      csvCandles.push(c);
    }

    const jsonlCandles: {
      timestamp: number;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }[] = [];
    for await (const c of jsonlLoader.candles()) {
      jsonlCandles.push(c);
    }

    expect(csvCandles).toEqual(jsonlCandles);
  });
});
