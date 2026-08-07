import type { Candle } from '@trading/core';
import type { DetectorMap } from './pattern-types.js';
import { bodySize, isBearish, isBullish, range } from './pattern-shape.js';

function triple(candles: Candle[]): [Candle, Candle, Candle] | null {
  if (candles.length < 3) return null;
  return [candles[candles.length - 3], candles[candles.length - 2], candles[candles.length - 1]];
}

function midpoint(c: Candle): number {
  return (c.open + c.close) / 2;
}

/** Second candle near-doji body: used as the "star" gap candle. */
function isStar(c: Candle): boolean {
  return range(c) > 0 && bodySize(c) <= 0.1 * (c.high - c.low);
}

function morningStar(c0: Candle, c1: Candle, c2: Candle): boolean {
  if (!isBearish(c0)) return false;
  if (!isStar(c1)) return false;
  if (!isBullish(c2)) return false;
  return c1.close < c0.low && c2.close > midpoint(c0);
}

function eveningStar(c0: Candle, c1: Candle, c2: Candle): boolean {
  if (!isBullish(c0)) return false;
  if (!isStar(c1)) return false;
  if (!isBearish(c2)) return false;
  return c1.close > c0.high && c2.close < midpoint(c0);
}

function threeSameDirection(candles: Candle[], direction: 'bullish' | 'bearish'): boolean {
  for (let i = 0; i < 3; i++) {
    const c = candles[i];
    if (range(c) <= 0) return false;
    const body = bodySize(c);
    const okBody = direction === 'bullish' ? isBullish(c) : isBearish(c);
    if (!okBody || body < 0.4 * range(c)) return false;
    if (i > 0) {
      const prev = candles[i - 1];
      const rising = direction === 'bullish' ? c.close > prev.close : c.close < prev.close;
      if (!rising) return false;
    }
  }
  return true;
}

export const tripleDetectors: DetectorMap = {
  morningStar: {
    version: '1.0.0',
    run: (candles) => {
      const t = triple(candles);
      return t !== null && morningStar(t[0], t[1], t[2]);
    },
  },
  eveningStar: {
    version: '1.0.0',
    run: (candles) => {
      const t = triple(candles);
      return t !== null && eveningStar(t[0], t[1], t[2]);
    },
  },
  threeWhiteSoldiers: {
    version: '1.0.0',
    run: (candles) =>
      candles.length >= 3 ? threeSameDirection(candles.slice(-3), 'bullish') : false,
  },
  threeBlackCrows: {
    version: '1.0.0',
    run: (candles) =>
      candles.length >= 3 ? threeSameDirection(candles.slice(-3), 'bearish') : false,
  },
};
