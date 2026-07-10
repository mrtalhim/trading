import { describe, it, expect } from 'vitest';
import { kellyFraction } from '../kelly.js';

describe('kellyFraction', () => {
  it('returns correct fraction for positive edge', () => {
    const result = kellyFraction(0.6, 2, 0.5);
    expect(result).toBeCloseTo(0.4, 5);
  });

  it('returns 0 when win rate <= 0', () => {
    const result = kellyFraction(0, 2, 0.5);
    expect(result).toBe(0);
  });

  it('returns 0 when win rate >= 1', () => {
    const result = kellyFraction(1, 2, 0.5);
    expect(result).toBe(0);
  });

  it('returns 0 when payoff ratio <= 0', () => {
    const result = kellyFraction(0.6, 0, 0.5);
    expect(result).toBe(0);
  });

  it('caps at maxPosition', () => {
    const result = kellyFraction(0.9, 3, 0.1);
    expect(result).toBe(0.1);
  });

  it('returns 0 for negative edge', () => {
    const result = kellyFraction(0.3, 1, 0.5);
    expect(result).toBe(0);
  });
});
