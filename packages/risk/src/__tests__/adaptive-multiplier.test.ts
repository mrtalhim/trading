import { describe, expect, it } from 'vitest';
import { selectAdaptiveMultipliers } from '../adaptive-multiplier.js';

const EXPANDING = { stopMult: 3, tpMult: 3 };
const NEUTRAL = { stopMult: 2, tpMult: 3 };
const CONTRACTING = { stopMult: 1, tpMult: 2 };

function windowWith(values: { value: number; count: number }[]): number[] {
  const out: number[] = [];
  for (const { value, count } of values) {
    for (let i = 0; i < count; i++) out.push(value);
  }
  return out;
}

describe('selectAdaptiveMultipliers', () => {
  it('expanding: current ATR ranks at or above the 75th percentile', () => {
    // 72 low values + 24 high values → p = 1.0
    const w = windowWith([
      { value: 10, count: 72 },
      { value: 20, count: 24 },
    ]);
    expect(selectAdaptiveMultipliers(w, 20)).toEqual({ state: 'expanding', ...EXPANDING });
  });

  it('expanding: boundary p === 0.75 selects expanding', () => {
    const w = windowWith([
      { value: 10, count: 72 },
      { value: 20, count: 24 },
    ]);
    expect(selectAdaptiveMultipliers(w, 15)).toEqual({ state: 'expanding', ...EXPANDING });
  });

  it('contracting: current ATR clearly below the 25th percentile', () => {
    const w = windowWith([
      { value: 20, count: 76 },
      { value: 5, count: 20 },
    ]);
    expect(selectAdaptiveMultipliers(w, 5)).toEqual({ state: 'contracting', ...CONTRACTING });
  });

  it('contracting: boundary p === 0.25 selects contracting', () => {
    const w = windowWith([
      { value: 20, count: 72 },
      { value: 5, count: 24 },
    ]);
    expect(selectAdaptiveMultipliers(w, 5)).toEqual({ state: 'contracting', ...CONTRACTING });
  });

  it('neutral: mid-percentile ATR selects the 2/3 multipliers', () => {
    const w = windowWith([
      { value: 5, count: 24 },
      { value: 10, count: 24 },
      { value: 15, count: 24 },
      { value: 20, count: 24 },
    ]);
    expect(selectAdaptiveMultipliers(w, 10)).toEqual({ state: 'neutral', ...NEUTRAL });
  });

  it('warmup: fewer than 15 window values falls back to neutral', () => {
    const w = [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10];
    expect(w).toHaveLength(14);
    expect(selectAdaptiveMultipliers(w, 20)).toEqual({ state: 'neutral', ...NEUTRAL });
  });

  it('empty window falls back to neutral', () => {
    expect(selectAdaptiveMultipliers([], 20)).toEqual({ state: 'neutral', ...NEUTRAL });
  });

  it('non-finite or non-positive ATR falls back to neutral', () => {
    const w = windowWith([
      { value: 10, count: 72 },
      { value: 20, count: 24 },
    ]);
    expect(selectAdaptiveMultipliers(w, Number.NaN)).toEqual({ state: 'neutral', ...NEUTRAL });
    expect(selectAdaptiveMultipliers(w, 0)).toEqual({ state: 'neutral', ...NEUTRAL });
    expect(selectAdaptiveMultipliers(w, -5)).toEqual({ state: 'neutral', ...NEUTRAL });
  });

  it('is deterministic for identical inputs', () => {
    const w = windowWith([
      { value: 10, count: 72 },
      { value: 20, count: 24 },
    ]);
    expect(selectAdaptiveMultipliers(w, 20)).toEqual(selectAdaptiveMultipliers(w, 20));
  });
});
