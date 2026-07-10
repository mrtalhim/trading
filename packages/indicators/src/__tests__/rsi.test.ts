import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { rsi } from '../rsi.js';
import type { Candle } from '@trading/core';

const candles: Candle[] = JSON.parse(readFileSync('tests/fixtures/candles.json', 'utf-8'));

describe('rsi', () => {
  it('returns correct RSI(14) for the fixture', () => {
    const result = rsi(candles, 14);
    expect(result.value).toBeCloseTo(78.81, 1);
  });

  it('returns NaN with insufficient data (needs period + 1)', () => {
    const result = rsi(candles.slice(0, 14), 14);
    expect(result.value).toBeNaN();
  });

  it('returns 100 when all gains and no losses', () => {
    const allUp = candles.map((c, i) => ({
      ...c,
      close: 50000 + i * 100,
      open: 50000 + i * 100 - 10,
      low: 50000 + i * 100 - 20,
      high: 50000 + i * 100 + 20,
    }));
    const result = rsi(allUp, 14);
    expect(result.value).toBe(100);
  });

  it('is deterministic', () => {
    const a = rsi(candles, 14);
    const b = rsi(candles, 14);
    expect(a.value).toBe(b.value);
  });

  it('includes metadata', () => {
    const result = rsi(candles, 14);
    expect(result.metadata.pipelineVersion).toBeDefined();
    expect(result.metadata.candlesConsumed).toBe(30);
  });
});
