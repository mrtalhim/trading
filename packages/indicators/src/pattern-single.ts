import type { Candle } from '@trading/core';
import type { DetectorMap } from './pattern-types.js';
import { bodySize, lowerWick, range, upperWick } from './pattern-shape.js';

type PriorTrend = 'up' | 'down' | 'flat';

/**
 * Direction of the close over the `n` candles immediately before the last candle.
 * The last candle is the pattern target and is excluded from the trend measure.
 */
function priorTrend(candles: Candle[], n: number): PriorTrend {
  if (candles.length < n + 2) return 'flat';
  const prev = candles[candles.length - 1 - n].close;
  const last = candles[candles.length - 2].close;
  if (last > prev) return 'up';
  if (last < prev) return 'down';
  return 'flat';
}

const TREND_CANDLES = 3;

function isDoji(c: Candle): boolean {
  if (range(c) <= 0) return false;
  return bodySize(c) <= 0.02 * range(c);
}

function isMarubozu(c: Candle): boolean {
  if (range(c) <= 0) return false;
  return (
    bodySize(c) >= 0.9 * range(c) && upperWick(c) < 0.1 * range(c) && lowerWick(c) < 0.1 * range(c)
  );
}

function hammerShape(c: Candle): boolean {
  if (range(c) <= 0) return false;
  const body = bodySize(c);
  const lower = lowerWick(c);
  return body < 0.3 * range(c) && lower >= 2 * body && lower >= 0.4 * range(c);
}

function invertedHammerShape(c: Candle): boolean {
  if (range(c) <= 0) return false;
  const body = bodySize(c);
  const upper = upperWick(c);
  return body < 0.3 * range(c) && upper >= 2 * body && upper >= 0.4 * range(c);
}

export const singleDetectors: DetectorMap = {
  doji: {
    version: '1.0.0',
    run: (candles) => (candles.length >= 1 ? isDoji(candles[candles.length - 1]) : false),
  },
  hammer: {
    version: '1.0.0',
    run: (candles) => {
      if (candles.length < TREND_CANDLES + 2) return false;
      const last = candles[candles.length - 1];
      return hammerShape(last) && priorTrend(candles, TREND_CANDLES) === 'down';
    },
  },
  invertedHammer: {
    version: '1.0.0',
    run: (candles) => {
      if (candles.length < TREND_CANDLES + 2) return false;
      const last = candles[candles.length - 1];
      return invertedHammerShape(last) && priorTrend(candles, TREND_CANDLES) === 'down';
    },
  },
  hangingMan: {
    version: '1.0.0',
    run: (candles) => {
      if (candles.length < TREND_CANDLES + 2) return false;
      const last = candles[candles.length - 1];
      return hammerShape(last) && priorTrend(candles, TREND_CANDLES) === 'up';
    },
  },
  shootingStar: {
    version: '1.0.0',
    run: (candles) => {
      if (candles.length < TREND_CANDLES + 2) return false;
      const last = candles[candles.length - 1];
      return invertedHammerShape(last) && priorTrend(candles, TREND_CANDLES) === 'up';
    },
  },
  marubozu: {
    version: '1.0.0',
    run: (candles) => (candles.length >= 1 ? isMarubozu(candles[candles.length - 1]) : false),
  },
};
