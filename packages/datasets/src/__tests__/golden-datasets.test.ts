import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Candle } from '@trading/core';
import { validateCandles, computeChecksum, DatasetMetadataSchema } from '../index.js';

const GOLDEN_DIR = join(process.cwd(), 'datasets', 'golden');

const datasets = readdirSync(GOLDEN_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name);

describe('golden datasets', () => {
  it('discovers at least the Indodax and synthetic datasets', () => {
    expect(datasets).toContain('btc_idr_15m');
    expect(datasets).toContain('btc_15m');
  });

  for (const name of datasets) {
    describe(name, () => {
      const dir = join(GOLDEN_DIR, name);
      const metadata = DatasetMetadataSchema.parse(
        JSON.parse(readFileSync(join(dir, 'metadata.json'), 'utf-8')),
      );
      const candles: Candle[] = readFileSync(join(dir, 'candles.jsonl'), 'utf-8')
        .split('\n')
        .filter((l) => l.trim() !== '')
        .map((l) => JSON.parse(l) as Candle);

      it('passes candle validation (timestamps, OHLCV, intervals)', () => {
        const result = validateCandles(candles, metadata.interval);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('checksum matches computed value', () => {
        expect(computeChecksum(candles)).toBe(metadata.checksum);
      });

      it('candle count matches metadata', () => {
        expect(candles.length).toBe(metadata.candleCount);
      });
    });
  }
});
