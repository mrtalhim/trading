import { describe, it, expect } from 'vitest';
import { positionSize } from '../sizing.js';

describe('positionSize', () => {
  it('returns correct position for normal inputs', () => {
    const result = positionSize(100000, 50000, { fraction: 0.1 });
    expect(result).toBe(10000);
  });

  it('returns zero when cash is zero', () => {
    const result = positionSize(100000, 0, { fraction: 0.1 });
    expect(result).toBe(0);
  });

  it('never returns negative', () => {
    const result = positionSize(100000, -1000, { fraction: 0.1 });
    expect(result).toBe(0);
  });

  it('clamps to available cash', () => {
    const result = positionSize(100000, 5000, { fraction: 0.1 });
    expect(result).toBe(5000);
  });

  it('respects minNotional', () => {
    const result = positionSize(100000, 5000, {
      fraction: 0.1,
      minNotional: 10000,
    });
    expect(result).toBe(10000);
  });

  it('returns zero when fraction is zero', () => {
    const result = positionSize(100000, 50000, { fraction: 0 });
    expect(result).toBe(0);
  });
});
