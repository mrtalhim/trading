import { describe, it, expect } from 'vitest';
import { adx } from '../adx.js';
import { loadGoldenDataset } from './helpers.js';

const candles = loadGoldenDataset('btc_15m');

describe('adx', () => {
  it('returns correct ADX(14) for the golden dataset', () => {
    const result = adx(candles, 14);
    expect(result.value).toBeCloseTo(38.19, 1);
  });

  it('returns NaN with insufficient data (needs 2 * period)', () => {
    const result = adx(candles.slice(0, 27), 14);
    expect(result.value).toBeNaN();
  });

  it('is deterministic', () => {
    const a = adx(candles, 14);
    const b = adx(candles, 14);
    expect(a.value).toBe(b.value);
  });

  it('includes metadata', () => {
    const result = adx(candles, 14);
    expect(result.metadata.pipelineVersion).toBeDefined();
    expect(result.metadata.candlesConsumed).toBe(100);
  });
});
