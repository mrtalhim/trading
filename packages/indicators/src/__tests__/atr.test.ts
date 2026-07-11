import { describe, it, expect } from 'vitest';
import { atr } from '../atr.js';
import { loadGoldenDataset } from './helpers.js';

const candles = loadGoldenDataset('btc_15m');

describe('atr', () => {
  it('returns correct ATR(14) for the golden dataset', () => {
    const result = atr(candles, 14);
    expect(result.value).toBeCloseTo(561.47, 1);
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
    expect(result.metadata.candlesConsumed).toBe(100);
  });
});
