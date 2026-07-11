import { describe, it, expect } from 'vitest';
import { sma } from '../sma.js';
import { loadGoldenDataset } from './helpers.js';

const candles = loadGoldenDataset('btc_15m');

describe('sma', () => {
  it('returns correct SMA(20) for the golden dataset', () => {
    const result = sma(candles, 20);
    expect(result.value).toBeCloseTo(48088.06, 1);
  });

  it('returns NaN when insufficient data', () => {
    const result = sma(candles.slice(0, 19), 20);
    expect(result.value).toBeNaN();
  });

  it('is deterministic', () => {
    const a = sma(candles, 14);
    const b = sma(candles, 14);
    expect(a.value).toBe(b.value);
  });

  it('includes metadata with pipelineVersion and candlesConsumed', () => {
    const result = sma(candles, 20);
    expect(result.metadata.pipelineVersion).toBeDefined();
    expect(result.metadata.pipelineVersion.length).toBe(16);
    expect(result.metadata.candlesConsumed).toBe(100);
  });
});
