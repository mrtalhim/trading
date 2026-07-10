import { describe, it, expect } from 'vitest';
import { atrTakeProfit } from '../take-profit.js';

describe('atrTakeProfit', () => {
  it('returns correct take profit price', () => {
    const result = atrTakeProfit(50000, 1000, 3);
    expect(result).toBe(53000);
  });

  it('handles zero ATR', () => {
    const result = atrTakeProfit(50000, 0, 3);
    expect(result).toBe(50000);
  });

  it('works with fractional multiplier', () => {
    const result = atrTakeProfit(50000, 1000, 2.5);
    expect(result).toBe(52500);
  });

  it('handles insufficient ATR history without crashing', () => {
    const result = atrTakeProfit(50000, NaN, 2);
    expect(result).toBeNaN();
  });
});
