import { describe, it, expect } from 'vitest';
import { atrStopLoss } from '../stop-loss.js';

describe('atrStopLoss', () => {
  it('returns correct stop loss price', () => {
    const result = atrStopLoss(50000, 1000, 2);
    expect(result).toBe(48000);
  });

  it('handles zero ATR', () => {
    const result = atrStopLoss(50000, 0, 2);
    expect(result).toBe(50000);
  });

  it('works with fractional multiplier', () => {
    const result = atrStopLoss(50000, 1000, 1.5);
    expect(result).toBe(48500);
  });

  it('handles insufficient ATR history without crashing', () => {
    const result = atrStopLoss(50000, NaN, 2);
    expect(result).toBeNaN();
  });
});
