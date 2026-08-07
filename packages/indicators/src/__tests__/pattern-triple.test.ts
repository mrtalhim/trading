import { describe, expect, it } from 'vitest';
import { detectPatternContext } from '../pattern-context.js';
import { makeCandle } from './pattern-helpers.js';

describe('triple-candle patterns', () => {
  it('detects a morning star', () => {
    const candles = [
      makeCandle(100, 104, 96, 102, 1000),
      makeCandle(118, 124, 111, 114, 1000),
      makeCandle(110.8, 111.2, 110.4, 110.75, 1000),
      makeCandle(112, 119, 105, 118, 1000),
    ];
    const ctx = detectPatternContext(candles);
    expect(ctx.triple.morningStar).toBe(true);
    expect(ctx.triple.eveningStar).toBe(false);
  });

  it('detects an evening star', () => {
    const candles = [
      makeCandle(100, 104, 96, 102, 1000),
      makeCandle(112, 124, 110, 118, 1000),
      makeCandle(124.6, 126, 124.2, 124.7, 1000),
      makeCandle(120, 123, 114, 114.8, 1000),
    ];
    const ctx = detectPatternContext(candles);
    expect(ctx.triple.eveningStar).toBe(true);
    expect(ctx.triple.morningStar).toBe(false);
  });

  it('does not fire a morning star when the star does not gap below', () => {
    const candles = [
      makeCandle(100, 104, 96, 102, 1000),
      makeCandle(118, 124, 111, 114, 1000),
      makeCandle(115.4, 116, 114.8, 115.7, 1000),
      makeCandle(112, 119, 105, 118, 1000),
    ];
    const ctx = detectPatternContext(candles);
    expect(ctx.triple.morningStar).toBe(false);
    expect(ctx.triple.eveningStar).toBe(false);
  });

  it('detects three white soldiers', () => {
    const candles = [
      makeCandle(98, 102, 94, 98, 1000),
      makeCandle(100, 106, 99, 105, 1000),
      makeCandle(104, 110, 103, 109, 1000),
      makeCandle(108, 114, 107, 113, 1000),
    ];
    const ctx = detectPatternContext(candles);
    expect(ctx.triple.threeWhiteSoldiers).toBe(true);
    expect(ctx.triple.threeBlackCrows).toBe(false);
  });

  it('detects three black crows', () => {
    const candles = [
      makeCandle(118, 122, 114, 118, 1000),
      makeCandle(115, 116, 109, 110, 1000),
      makeCandle(111, 112, 105, 106, 1000),
      makeCandle(107, 108, 101, 102, 1000),
    ];
    const ctx = detectPatternContext(candles);
    expect(ctx.triple.threeBlackCrows).toBe(true);
    expect(ctx.triple.threeWhiteSoldiers).toBe(false);
  });

  it('does not fire soldiers/crows on mixed colors', () => {
    const candles = [
      makeCandle(100, 106, 99, 105, 1000),
      makeCandle(104, 110, 103, 109, 1000),
      makeCandle(108, 112, 105, 106, 1000),
    ];
    const ctx = detectPatternContext(candles);
    expect(ctx.triple.threeWhiteSoldiers).toBe(false);
    expect(ctx.triple.threeBlackCrows).toBe(false);
  });

  it('returns false instead of crashing with fewer than three candles', () => {
    const ctx = detectPatternContext([
      makeCandle(100, 106, 99, 105, 1000),
      makeCandle(104, 110, 103, 109, 1000),
    ]);
    expect(ctx.triple.morningStar).toBe(false);
    expect(ctx.triple.eveningStar).toBe(false);
    expect(ctx.triple.threeWhiteSoldiers).toBe(false);
    expect(ctx.triple.threeBlackCrows).toBe(false);
  });
});
