import { describe, it, expect } from 'vitest';
import { rsi } from '../rsi.js';
import { loadGoldenDataset } from './helpers.js';

const candles = loadGoldenDataset('btc_15m');

describe('rsi', () => {
  it('returns correct RSI(14) for the golden dataset', () => {
    const result = rsi(candles, 14);
    expect(result.value).toBeCloseTo(61.67, 1);
  });

  it('returns NaN with insufficient data (needs period + 1)', () => {
    const result = rsi(candles.slice(0, 14), 14);
    expect(result.value).toBeNaN();
  });

  it('returns 100 when all gains and no losses', () => {
    const allUp = candles.map((c, i) => ({
      ...c,
      close: 42000 + i * 100,
      open: 42000 + i * 100 - 10,
      low: 42000 + i * 100 - 20,
      high: 42000 + i * 100 + 20,
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
    expect(result.metadata.candlesConsumed).toBe(100);
  });
});
