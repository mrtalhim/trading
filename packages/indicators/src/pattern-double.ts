import type { Candle } from '@trading/core';
import type { DetectorMap } from './pattern-types.js';
import { bodyRegion, bodySize, isBearish, isBullish, range } from './pattern-shape.js';

function pair(candles: Candle[]): [Candle, Candle] | null {
  if (candles.length < 2) return null;
  return [candles[candles.length - 2], candles[candles.length - 1]];
}

function midpoint(c: Candle): number {
  return (c.open + c.close) / 2;
}

function engulfing(prev: Candle, curr: Candle, direction: 'bullish' | 'bearish'): boolean {
  if (direction === 'bullish') {
    if (!isBearish(prev) || !isBullish(curr)) return false;
    return curr.open < prev.close && curr.close > prev.open;
  }
  if (!isBullish(prev) || !isBearish(curr)) return false;
  return curr.open > prev.close && curr.close < prev.open;
}

function piercing(prev: Candle, curr: Candle): boolean {
  if (!isBearish(prev) || !isBullish(curr)) return false;
  return curr.open < prev.close && curr.close > midpoint(prev) && curr.close < prev.open;
}

function darkCloud(prev: Candle, curr: Candle): boolean {
  if (!isBullish(prev) || !isBearish(curr)) return false;
  return curr.open > prev.close && curr.close < midpoint(prev) && curr.close > prev.open;
}

function insideBody(prev: Candle, curr: Candle): boolean {
  const prevRegion = bodyRegion(prev);
  return curr.high <= prevRegion.top && curr.low >= prevRegion.bottom;
}

function harami(prev: Candle, curr: Candle, direction: 'bullish' | 'bearish'): boolean {
  if (range(prev) <= 0) return false;
  if (prev.open === prev.close) return false;
  const bigBody = bodySize(prev) >= 0.4 * range(prev);
  if (!bigBody) return false;
  if (curr.open === curr.close) return false;
  if (bodySize(curr) > bodySize(prev)) return false;
  if (!insideBody(prev, curr)) return false;
  if (direction === 'bullish') {
    return isBearish(prev) && isBullish(curr);
  }
  return isBullish(prev) && isBearish(curr);
}

export const doubleDetectors: DetectorMap = {
  bullishEngulfing: {
    version: '1.0.0',
    run: (candles) => {
      const p = pair(candles);
      return p !== null && engulfing(p[0], p[1], 'bullish');
    },
  },
  bearishEngulfing: {
    version: '1.0.0',
    run: (candles) => {
      const p = pair(candles);
      return p !== null && engulfing(p[0], p[1], 'bearish');
    },
  },
  piercingLine: {
    version: '1.0.0',
    run: (candles) => {
      const p = pair(candles);
      return p !== null && piercing(p[0], p[1]);
    },
  },
  darkCloudCover: {
    version: '1.0.0',
    run: (candles) => {
      const p = pair(candles);
      return p !== null && darkCloud(p[0], p[1]);
    },
  },
  bullishHarami: {
    version: '1.0.0',
    run: (candles) => {
      const p = pair(candles);
      return p !== null && harami(p[0], p[1], 'bullish');
    },
  },
  bearishHarami: {
    version: '1.0.0',
    run: (candles) => {
      const p = pair(candles);
      return p !== null && harami(p[0], p[1], 'bearish');
    },
  },
};
