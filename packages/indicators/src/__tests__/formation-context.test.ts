import { describe, expect, it } from 'vitest';
import type { Candle } from '@trading/core';
import { buildFormationVersion, detectFormationContext } from '../formation-context.js';

let seq = 0;
function candle(close: number): Candle {
  return {
    timestamp: 1700000000000 + seq++ * 900000,
    open: close,
    high: close,
    low: close,
    close,
    volume: 1000,
  };
}

/** Builder: linear interpolation between [barIndex, close] control points. */
function series(points: Array<[number, number]>): Candle[] {
  const last = points[points.length - 1][0];
  const out: Candle[] = [];
  let pi = 0;
  for (let i = 0; i <= last; i++) {
    while (pi < points.length - 1 && i > points[pi + 1][0]) pi++;
    const [x0, y0] = points[pi];
    const [x1, y1] = points[Math.min(pi + 1, points.length - 1)];
    const t = x1 === x0 ? 0 : (i - x0) / (x1 - x0);
    out.push(candle(y0 + (y1 - y0) * t));
  }
  return out;
}

describe('formation context (M3.9)', () => {
  it('detects a completed head-and-shoulders', () => {
    const candles = series([
      [0, 100],
      [7, 120],
      [12, 105],
      [20, 130],
      [26, 104],
      [33, 118],
      [38, 99],
    ]);
    const ctx = detectFormationContext(candles);
    expect(ctx.headAndShoulders).toBe(true);
    expect(ctx.inverseHeadAndShoulders).toBe(false);
    expect(ctx.doubleTop).toBe(false);
    expect(ctx.doubleBottom).toBe(false);
    expect(ctx.necklinePrice).toBeGreaterThan(99);
    expect(ctx.necklinePrice).toBeLessThan(104);
    expect(Math.abs(ctx.necklineSlopePct!)).toBeLessThan(5);
  });

  it('detects a completed inverse head-and-shoulders', () => {
    const candles = series([
      [0, 100],
      [7, 80],
      [12, 95],
      [20, 70],
      [26, 96],
      [33, 82],
      [38, 105],
    ]);
    const ctx = detectFormationContext(candles);
    expect(ctx.inverseHeadAndShoulders).toBe(true);
    expect(ctx.headAndShoulders).toBe(false);
    expect(ctx.doubleBottom).toBe(false);
    expect(ctx.necklinePrice).toBeLessThan(105);
  });

  it('detects a completed double top', () => {
    const candles = series([
      [0, 100],
      [8, 120],
      [14, 108],
      [22, 119],
      [33, 102],
    ]);
    const ctx = detectFormationContext(candles);
    expect(ctx.doubleTop).toBe(true);
    expect(ctx.doubleBottom).toBe(false);
    expect(ctx.headAndShoulders).toBe(false);
    expect(ctx.necklinePrice).toBe(108);
    expect(ctx.necklineSlopePct).toBe(0);
  });

  it('detects a completed double bottom', () => {
    const candles = series([
      [0, 100],
      [8, 80],
      [14, 92],
      [22, 81],
      [33, 96],
    ]);
    const ctx = detectFormationContext(candles);
    expect(ctx.doubleBottom).toBe(true);
    expect(ctx.doubleTop).toBe(false);
    expect(ctx.inverseHeadAndShoulders).toBe(false);
    expect(ctx.necklinePrice).toBe(92);
  });

  it('does not fire when the confirmation close has not crossed the neckline', () => {
    const candles = series([
      [0, 100],
      [7, 120],
      [12, 105],
      [20, 130],
      [26, 104],
      [33, 118],
      [38, 110],
    ]);
    const ctx = detectFormationContext(candles);
    expect(ctx.headAndShoulders).toBe(false);
    expect(ctx.doubleTop).toBe(false);
  });

  it('does not fire a double top with unequal tops beyond the 5% tolerance', () => {
    const candles = series([
      [0, 100],
      [8, 120],
      [14, 108],
      [22, 128],
      [33, 102],
    ]);
    expect(detectFormationContext(candles).doubleTop).toBe(false);
  });

  it('does not fire H&S with asymmetric shoulders beyond the 5% tolerance', () => {
    const candles = series([
      [0, 100],
      [7, 120],
      [12, 105],
      [20, 130],
      [26, 104],
      [33, 105],
      [38, 99],
    ]);
    expect(detectFormationContext(candles).headAndShoulders).toBe(false);
  });

  it('does not fire H&S with a neckline steeper than the committed 5%', () => {
    const candles = series([
      [0, 100],
      [7, 120],
      [12, 100],
      [20, 130],
      [26, 118],
      [33, 120],
      [38, 90],
    ]);
    const ctx = detectFormationContext(candles);
    expect(ctx.headAndShoulders).toBe(false);
    // No formation fired → no neckline is surfaced (never a stale value).
    expect(ctx.necklineSlopePct).toBe(null);
  });

  it('returns false for all formations on insufficient history instead of crashing', () => {
    const short = series([
      [0, 100],
      [8, 120],
      [14, 108],
      [22, 119],
    ]);
    const ctx = detectFormationContext(short);
    expect(ctx.headAndShoulders).toBe(false);
    expect(ctx.inverseHeadAndShoulders).toBe(false);
    expect(ctx.doubleTop).toBe(false);
    expect(ctx.doubleBottom).toBe(false);
    expect(ctx.formationVersion).toMatch(/^[0-9a-f]{16}$/);
  });

  it('renders pivot counts over the window', () => {
    const ctx = detectFormationContext(
      series([
        [0, 100],
        [7, 120],
        [12, 105],
        [20, 130],
        [26, 104],
        [33, 118],
        [38, 99],
      ]),
    );
    expect(ctx.pivots.total).toBe(5);
    expect(ctx.pivots.high).toBe(3);
    expect(ctx.pivots.low).toBe(2);
  });

  it('is deterministic: same candles, same output', () => {
    const candles = series([
      [0, 100],
      [7, 120],
      [12, 105],
      [20, 130],
      [26, 104],
      [33, 118],
      [38, 99],
    ]);
    expect(detectFormationContext(candles)).toEqual(detectFormationContext(candles));
  });

  it('formationVersion is a 16-char hex hash that changes when options change', () => {
    expect(buildFormationVersion()).toMatch(/^[0-9a-f]{16}$/);
    expect(buildFormationVersion()).not.toBe(buildFormationVersion({ shoulderSymmetry: 0.1 }));
    expect(buildFormationVersion()).not.toBe(buildFormationVersion({ minFormationSpan: 40 }));
  });

  it('never crashes on empty input', () => {
    const ctx = detectFormationContext([]);
    expect(ctx.pivots.total).toBe(0);
    expect(ctx.headAndShoulders).toBe(false);
    expect(ctx.necklinePrice).toBe(null);
    expect(ctx.formationVersion).toMatch(/^[0-9a-f]{16}$/);
  });
});
