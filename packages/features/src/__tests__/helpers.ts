import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Candle } from '@trading/core';
import type { Dataset, DatasetMetadata } from '@trading/datasets';

export function loadGoldenDataset(name: string): Candle[] {
  const path = resolve(process.cwd(), 'datasets/golden', name, 'candles.jsonl');
  const raw = readFileSync(path, 'utf-8');
  return raw
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as Candle);
}

export function inMemoryDataset(candles: Candle[], metadata: DatasetMetadata): Dataset {
  return {
    metadata: async () => metadata,
    candles: async function* () {
      for (const candle of candles) {
        yield candle;
      }
    },
  };
}

export const sampleMetadata: DatasetMetadata = {
  exchange: 'synthetic',
  pair: 'BTCUSDT',
  interval: '15m',
  timezone: 'UTC',
  source: 'hand-crafted',
  start: 1700000000000,
  end: 1700089100000,
  candleCount: 100,
  checksum: 'd7ab1989c0a64345',
  includes: { candles: true, ticker: false, orderbook: false, trades: false },
};
