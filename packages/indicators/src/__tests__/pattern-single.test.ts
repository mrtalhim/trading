import { describe, expect, it } from 'vitest';
import { detectPatternContext } from '../pattern-context.js';
import { makeCandle } from './pattern-helpers.js';

describe('single-candle patterns', () => {
  it('detects a doji and not a marubozu on a flat-bodied candle', () => {
    const candles = [
      makeCandle(100, 103, 98, 102, 1000),
      makeCandle(102, 105, 100, 104, 1000),
      makeCandle(104.2, 108, 104, 104.21, 1000),
    ];
    const ctx = detectPatternContext(candles);
    expect(ctx.single.doji).toBe(true);
    expect(ctx.single.marubozu).toBe(false);
  });

  it('detects a marubozu and not a doji on a full-body candle', () => {
    const candles = [
      makeCandle(100, 102, 95, 101, 1000),
      makeCandle(101, 103, 96, 102, 1000),
      makeCandle(100, 110, 99.9, 110, 1000),
    ];
    const ctx = detectPatternContext(candles);
    expect(ctx.single.marubozu).toBe(true);
    expect(ctx.single.doji).toBe(false);
  });

  it('detects a hammer after a downtrend', () => {
    const candles = [
      makeCandle(120, 125, 115, 118, 1000),
      makeCandle(118, 123, 113, 115, 1000),
      makeCandle(115, 120, 110, 112, 1000),
      makeCandle(112, 117, 107, 109, 1000),
      makeCandle(109, 110, 95, 109.2, 1000),
    ];
    const ctx = detectPatternContext(candles);
    expect(ctx.single.hammer).toBe(true);
    expect(ctx.single.hangingMan).toBe(false);
  });

  it('detects a hangingMan after an uptrend on the same shape', () => {
    const candles = [
      makeCandle(100, 105, 95, 102, 1000),
      makeCandle(102, 107, 97, 104, 1000),
      makeCandle(104, 109, 99, 106, 1000),
      makeCandle(106, 111, 101, 108, 1000),
      makeCandle(108, 110, 100, 108.5, 1000),
    ];
    const ctx = detectPatternContext(candles);
    expect(ctx.single.hangingMan).toBe(true);
    expect(ctx.single.hammer).toBe(false);
  });

  it('detects an invertedHammer after a downtrend', () => {
    const candles = [
      makeCandle(120, 125, 115, 118, 1000),
      makeCandle(118, 123, 113, 115, 1000),
      makeCandle(115, 120, 110, 112, 1000),
      makeCandle(112, 117, 107, 109, 1000),
      makeCandle(109.2, 123, 108.4, 109, 1000),
    ];
    const ctx = detectPatternContext(candles);
    expect(ctx.single.invertedHammer).toBe(true);
    expect(ctx.single.shootingStar).toBe(false);
  });

  it('detects a shootingStar after an uptrend on the same shape', () => {
    const candles = [
      makeCandle(100, 105, 95, 102, 1000),
      makeCandle(102, 107, 97, 104, 1000),
      makeCandle(104, 109, 99, 106, 1000),
      makeCandle(106, 111, 101, 108, 1000),
      makeCandle(108.5, 123, 107.6, 108.1, 1000),
    ];
    const ctx = detectPatternContext(candles);
    expect(ctx.single.shootingStar).toBe(true);
    expect(ctx.single.invertedHammer).toBe(false);
  });

  it('does not fire single patterns on a plain trending candle', () => {
    const candles = [
      makeCandle(100, 103, 98, 102, 1000),
      makeCandle(102, 105, 100, 104, 1000),
      makeCandle(104, 107, 102, 106, 1000),
      makeCandle(106, 109, 104, 108, 1000),
    ];
    const ctx = detectPatternContext(candles);
    expect(ctx.single.doji).toBe(false);
    expect(ctx.single.hammer).toBe(false);
    expect(ctx.single.invertedHammer).toBe(false);
    expect(ctx.single.hangingMan).toBe(false);
    expect(ctx.single.shootingStar).toBe(false);
    expect(ctx.single.marubozu).toBe(false);
  });

  it('returns false instead of crashing on insufficient history', () => {
    const ctx = detectPatternContext([makeCandle(100, 105, 95, 103, 1000)]);
    expect(ctx.single.doji).toBe(false);
    expect(ctx.single.hammer).toBe(false);
    expect(ctx.single.invertedHammer).toBe(false);
    expect(ctx.single.hangingMan).toBe(false);
    expect(ctx.single.shootingStar).toBe(false);
    expect(ctx.single.marubozu).toBe(false);

    const empty = detectPatternContext([]);
    expect(empty.single.doji).toBe(false);
  });
});
