import type { Candle } from '@trading/core';
import type { IndicatorResult } from '@trading/core';
import { pipelineVersion } from './utils.js';

function trueRange(candle: Candle, prevClose: number): number {
  const hl = candle.high - candle.low;
  const hc = Math.abs(candle.high - prevClose);
  const lc = Math.abs(candle.low - prevClose);
  return Math.max(hl, hc, lc);
}

export function atr(candles: Candle[], period: number = 14): IndicatorResult<number> {
  const candlesConsumed = candles.length;
  const meta = {
    pipelineVersion: pipelineVersion('atr', { period }),
    candlesConsumed,
  };

  if (candlesConsumed < period + 1) {
    return { value: NaN, metadata: meta };
  }

  const trValues: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    trValues.push(trueRange(candles[i], candles[i - 1].close));
  }

  const initialSlice = trValues.slice(0, period);
  const initialSum = initialSlice.reduce((a, b) => a + b, 0);
  let atrValue = initialSum / period;

  for (let i = period; i < trValues.length; i++) {
    atrValue = (atrValue * (period - 1) + trValues[i]) / period;
  }

  return { value: atrValue, metadata: meta };
}
