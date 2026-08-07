import { describe, expect, it } from 'vitest';
import { detectPatternContext } from '../pattern-context.js';
import { makeCandle } from './pattern-helpers.js';

describe('double-candle patterns', () => {
  it('detects a bullish engulfing over the last two candles', () => {
    const candles = [
      makeCandle(100, 104, 96, 102, 1000),
      makeCandle(112, 115, 108, 110, 1000),
      makeCandle(104, 120, 100, 114, 1000),
    ];
    const ctx = detectPatternContext(candles);
    expect(ctx.double.bullishEngulfing).toBe(true);
    expect(ctx.double.bearishEngulfing).toBe(false);
  });

  it('detects a bearish engulfing over the last two candles', () => {
    const candles = [
      makeCandle(104, 108, 98, 104, 1000),
      makeCandle(102, 110, 100, 108, 1000),
      makeCandle(110, 112, 96, 100, 1000),
    ];
    const ctx = detectPatternContext(candles);
    expect(ctx.double.bearishEngulfing).toBe(true);
    expect(ctx.double.bullishEngulfing).toBe(false);
  });

  it('does not fire engulfing when the current body does not contain the prior', () => {
    const candles = [
      makeCandle(100, 104, 96, 102, 1000),
      makeCandle(112, 120, 108, 110, 1000),
      makeCandle(104, 110, 100, 106, 1000),
    ];
    const ctx = detectPatternContext(candles);
    expect(ctx.double.bullishEngulfing).toBe(false);
    expect(ctx.double.bearishEngulfing).toBe(false);
  });

  it('detects a piercing line', () => {
    const candles = [
      makeCandle(122, 126, 116, 120, 1000),
      makeCandle(120, 122, 108, 112, 1000),
      makeCandle(108, 121, 104, 119.5, 1000),
    ];
    const ctx = detectPatternContext(candles);
    expect(ctx.double.piercingLine).toBe(true);
    expect(ctx.double.darkCloudCover).toBe(false);
  });

  it('detects a dark cloud cover', () => {
    const candles = [
      makeCandle(106, 112, 102, 106, 1000),
      makeCandle(108, 118, 112, 116, 1000),
      makeCandle(117, 121, 113, 111.5, 1000),
    ];
    const ctx = detectPatternContext(candles);
    expect(ctx.double.darkCloudCover).toBe(true);
    expect(ctx.double.piercingLine).toBe(false);
  });

  it('detects a bullish harami', () => {
    const candles = [
      makeCandle(126, 128, 120, 126, 1000),
      makeCandle(120, 120, 106, 114, 1000),
      makeCandle(118, 119, 114.5, 118.6, 1000),
    ];
    const ctx = detectPatternContext(candles);
    expect(ctx.double.bullishHarami).toBe(true);
    expect(ctx.double.bearishHarami).toBe(false);
  });

  it('detects a bearish harami', () => {
    const candles = [
      makeCandle(100, 104, 96, 102, 1000),
      makeCandle(108, 118, 106, 114, 1000),
      makeCandle(112, 113.8, 109, 110.5, 1000),
    ];
    const ctx = detectPatternContext(candles);
    expect(ctx.double.bearishHarami).toBe(true);
    expect(ctx.double.bullishHarami).toBe(false);
  });

  it('returns false instead of crashing with fewer than two candles', () => {
    const ctx = detectPatternContext([makeCandle(104, 120, 100, 114, 1000)]);
    expect(ctx.double.bullishEngulfing).toBe(false);
    expect(ctx.double.bearishEngulfing).toBe(false);
    expect(ctx.double.piercingLine).toBe(false);
    expect(ctx.double.darkCloudCover).toBe(false);
    expect(ctx.double.bullishHarami).toBe(false);
    expect(ctx.double.bearishHarami).toBe(false);
  });
});
