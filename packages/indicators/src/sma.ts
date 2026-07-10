import type { Candle } from '@trading/core';
import type { IndicatorResult } from '@trading/core';
import { pipelineVersion } from './utils.js';

export function sma(candles: Candle[], period: number = 20): IndicatorResult<number> {
  const candlesConsumed = candles.length;
  const meta = {
    pipelineVersion: pipelineVersion('sma', { period }),
    candlesConsumed,
  };

  if (candlesConsumed < period) {
    return { value: NaN, metadata: meta };
  }

  const slice = candles.slice(candlesConsumed - period);
  const sum = slice.reduce((acc, c) => acc + c.close, 0);
  return { value: sum / period, metadata: meta };
}
