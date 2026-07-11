import { describe, it, expect } from 'vitest';
import { vwap } from '../vwap.js';
import { loadGoldenDataset } from './helpers.js';

const candles = loadGoldenDataset('btc_15m');

describe('vwap', () => {
  it('returns correct VWAP for the golden dataset', () => {
    const result = vwap(candles);
    expect(result.value).toBeCloseTo(45695.75, 1);
  });

  it('returns NaN with zero candles', () => {
    const result = vwap([]);
    expect(result.value).toBeNaN();
  });

  it('is deterministic', () => {
    const a = vwap(candles);
    const b = vwap(candles);
    expect(a.value).toBe(b.value);
  });

  it('includes metadata', () => {
    const result = vwap(candles);
    expect(result.metadata.pipelineVersion).toBeDefined();
    expect(result.metadata.candlesConsumed).toBe(100);
  });
});
