import { describe, it, expect } from 'vitest';
import { ema } from '../ema.js';
import { loadGoldenDataset } from './helpers.js';

const candles = loadGoldenDataset('btc_15m');

describe('ema', () => {
  it('returns correct EMA(20) for the golden dataset', () => {
    const result = ema(candles, 20);
    expect(result.value).toBeCloseTo(48178.78, 1);
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
    expect(result.metadata.candlesConsumed).toBe(100);
  });
});
