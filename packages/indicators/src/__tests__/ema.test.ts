import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { ema } from '../ema.js';
import type { Candle } from '@trading/core';

const candles: Candle[] = JSON.parse(readFileSync('tests/fixtures/candles.json', 'utf-8'));

describe('ema', () => {
  it('returns correct EMA(20) for the fixture', () => {
    const result = ema(candles, 20);
    expect(result.value).toBeCloseTo(51726.82, 1);
  });

  it('returns NaN when insufficient data', () => {
    const result = ema(candles.slice(0, 19), 20);
    expect(result.value).toBeNaN();
  });

  it('is deterministic', () => {
    const a = ema(candles, 14);
    const b = ema(candles, 14);
    expect(a.value).toBe(b.value);
  });

  it('includes metadata', () => {
    const result = ema(candles, 20);
    expect(result.metadata.pipelineVersion).toBeDefined();
    expect(result.metadata.candlesConsumed).toBe(30);
  });
});
