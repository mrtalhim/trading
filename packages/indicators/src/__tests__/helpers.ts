import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Candle } from '@trading/core';

export function loadGoldenDataset(name: string): Candle[] {
  const path = resolve(process.cwd(), 'datasets/golden', name, 'candles.jsonl');
  const raw = readFileSync(path, 'utf-8');
  return raw
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as Candle);
}
