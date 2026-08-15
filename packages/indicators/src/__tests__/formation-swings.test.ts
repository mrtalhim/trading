import { describe, expect, it } from 'vitest';
import { detectSwings, medianClose, rawPivots } from '../formation-swings.js';
import type { Candle } from '@trading/core';

let seq = 0;
function candle(close: number, high = close, low = close): Candle {
  return {
    timestamp: 1700000000000 + seq++ * 900000,
    open: close,
    high,
    low,
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
    const close = y0 + (y1 - y0) * t;
    out.push(candle(close));
  }
  return out;
}

describe('swing-point detection', () => {
  it('finds fractal swing highs and lows with the committed ±2 window', () => {
    // bar 7 is a local max over ±2; bar 12 a local min over ±2.
    const candles = series([
      [0, 100],
      [7, 120],
      [12, 105],
      [20, 130],
      [26, 104],
      [33, 118],
      [38, 99],
    ]);
    const swings = detectSwings(candles);
    expect(swings.map((s) => [s.index, s.type])).toEqual([
      [7, 'high'],
      [12, 'low'],
      [20, 'high'],
      [26, 'low'],
      [33, 'high'],
    ]);
  });

  it('requires strict extremum: a flat top produces no pivot', () => {
    const candles = [
      candle(100),
      candle(100),
      candle(120),
      candle(120),
      candle(120),
      candle(100),
      candle(100),
      candle(100),
    ];
    const raw = rawPivots(candles, 2, 2);
    expect(raw.some((p) => p.type === 'high')).toBe(false);
  });

  it('returns [] for fewer than 2 candles and never throws on empty input', () => {
    expect(detectSwings([])).toEqual([]);
    expect(detectSwings([candle(100)])).toEqual([]);
  });

  it('suppresses micro-swings below the committed 0.5% floor', () => {
    // A flat ±0.2% oscillation yields no retained pivots.
    const candles: Candle[] = [];
    for (let i = 0; i < 20; i++) {
      const drift = 100 + (i % 2 === 0 ? 0.2 : -0.2);
      candles.push(candle(drift));
    }
    const median = medianClose(candles);
    const swings = detectSwings(candles);
    expect(swings.length).toBeLessThan(2);
    expect(median).toBeGreaterThan(99);
    expect(median).toBeLessThan(101);
  });

  it('is deterministic for identical input', () => {
    const candles = series([
      [0, 100],
      [7, 120],
      [12, 105],
      [20, 130],
      [26, 104],
      [33, 118],
      [38, 99],
    ]);
    expect(detectSwings(candles)).toEqual(detectSwings(candles));
  });
});
