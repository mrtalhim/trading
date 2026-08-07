import { describe, expect, it } from 'vitest';
import type { Candle } from '@trading/core';
import { detectPatternContext } from '../pattern-context.js';
import { downtrend, makeCandle, uptrend } from './pattern-helpers.js';

function flat(n: number, price = 100): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < n; i++) {
    out.push(makeCandle(price, price + 4, price - 4, price + 1, 1000));
  }
  return out;
}

describe('structural detectors', () => {
  it('classifies a monotonic uptrend', () => {
    const ctx = detectPatternContext(uptrend(14, 100, 2));
    expect(ctx.structural.trendStructure).toBe('higher_highs_higher_lows');
  });

  it('classifies a monotonic downtrend', () => {
    const ctx = detectPatternContext(downtrend(14, 200, 2));
    expect(ctx.structural.trendStructure).toBe('lower_highs_lower_lows');
  });

  it('classifies a ranging series', () => {
    const ctx = detectPatternContext(flat(14));
    expect(ctx.structural.trendStructure).toBe('ranging');
  });

  it('flags nearSupport at and just above the threshold boundary', () => {
    // Back window high=104, low=96, swingRange=8; threshold 0.15 => border = 1.2
    const back = flat(6);
    const atBorder = detectPatternContext([
      ...back,
      makeCandle(97.2, 98, 96.5, 97.2, 1000),
    ]).structural;
    expect(atBorder.nearSupport).toBe(true);

    const justOutside = detectPatternContext([
      ...back,
      makeCandle(97.3, 98, 96.5, 97.3, 1000),
    ]).structural;
    expect(justOutside.nearSupport).toBe(false);
    expect(justOutside.nearResistance).toBe(false);
  });

  it('flags nearResistance at and just below the threshold boundary', () => {
    const back = flat(14);
    const atBorder = detectPatternContext([
      ...back,
      makeCandle(102.8, 104, 102, 102.8, 1000),
    ]).structural;
    expect(atBorder.nearResistance).toBe(true);

    const justInside = detectPatternContext([
      ...back,
      makeCandle(102.7, 104, 102, 102.7, 1000),
    ]).structural;
    expect(justInside.nearResistance).toBe(false);
  });

  it('respects a custom proximity threshold', () => {
    const back = flat(14);
    const defaultCtx = detectPatternContext([
      ...back,
      makeCandle(97, 98, 96.5, 97, 1000),
    ]).structural;
    expect(defaultCtx.nearResistance).toBe(false);

    // threshold 0.4 => border 3.2; close 97 => 104 - 97 = 7 > 3.2 still false
    const wideCtx = detectPatternContext([...back, makeCandle(101, 102, 100.5, 101, 1000)], {
      proximityThreshold: 0.4,
    }).structural;
    // 104 - 101 = 3 <= 3.2 => now near resistance
    expect(wideCtx.nearResistance).toBe(true);
  });

  it('does not crash and reports defaults with insufficient history', () => {
    const ctx = detectPatternContext(flat(3));
    expect(ctx.structural.trendStructure).toBe('ranging');
    expect(ctx.structural.nearSupport).toBe(false);
    expect(ctx.structural.nearResistance).toBe(false);
  });
});
