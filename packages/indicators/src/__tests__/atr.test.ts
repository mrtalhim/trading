import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { atr } from '../atr.js';
import type { Candle } from '@trading/core';

const candles: Candle[] = JSON.parse(readFileSync('tests/fixtures/candles.json', 'utf-8'));

describe('atr', () => {
  it('returns correct ATR(14) for the fixture', () => {
    const result = atr(candles, 14);
    expect(result.value).toBeCloseTo(716.21, 1);
  });

  it('returns NaN with insufficient data (needs period + 1)', () => {
    const result = atr(candles.slice(0, 14), 14);
    expect(result.value).toBeNaN();
  });

  it('is deterministic', () => {
    const a = atr(candles, 14);
    const b = atr(candles, 14);
    expect(a.value).toBe(b.value);
  });

  it('includes metadata', () => {
    const result = atr(candles, 14);
    expect(result.metadata.pipelineVersion).toBeDefined();
    expect(result.metadata.candlesConsumed).toBe(30);
  });
});
