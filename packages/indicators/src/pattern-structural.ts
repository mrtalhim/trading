import type { Candle } from '@trading/core';
import type { PatternOptions, StructuralContext, TrendStructure } from './pattern-types.js';

function classifyTrend(window: Candle[]): TrendStructure {
  if (window.length < 4) return 'ranging';
  const mid = Math.floor(window.length / 2);
  const first = window.slice(0, mid);
  const second = window.slice(mid);
  const avg = (candles: Candle[], pick: (c: Candle) => number): number =>
    candles.reduce((sum, c) => sum + pick(c), 0) / candles.length;

  const highUp = avg(second, (c) => c.high) > avg(first, (c) => c.high);
  const lowUp = avg(second, (c) => c.low) > avg(first, (c) => c.low);
  const highDown = avg(second, (c) => c.high) < avg(first, (c) => c.high);
  const lowDown = avg(second, (c) => c.low) < avg(first, (c) => c.low);

  if (highUp && lowUp) return 'higher_highs_higher_lows';
  if (highDown && lowDown) return 'lower_highs_lower_lows';
  return 'ranging';
}

export function detectStructural(candles: Candle[], opts: PatternOptions): StructuralContext {
  if (candles.length < 2) {
    return { trendStructure: 'ranging', nearSupport: false, nearResistance: false };
  }

  const lookback = opts.structureLookback ?? 12;
  const threshold = opts.proximityThreshold ?? 0.15;
  const minCandles = opts.minStructureCandles ?? 5;

  const back = candles.slice(0, -1).slice(-lookback);
  const trend = classifyTrend(back);
  if (back.length < minCandles) {
    return { trendStructure: trend, nearSupport: false, nearResistance: false };
  }

  const swingHigh = Math.max(...back.map((c) => c.high));
  const swingLow = Math.min(...back.map((c) => c.low));
  const swingRange = swingHigh - swingLow;
  if (swingRange <= 0) {
    return { trendStructure: trend, nearSupport: false, nearResistance: false };
  }

  const close = candles[candles.length - 1].close;
  const tolerance = threshold * swingRange + 1e-9;
  return {
    trendStructure: trend,
    nearSupport: close - swingLow <= tolerance,
    nearResistance: swingHigh - close <= tolerance,
  };
}
