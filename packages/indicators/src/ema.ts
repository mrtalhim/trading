import type { Candle } from '@trading/core';
import type { IndicatorResult } from '@trading/core';
import { pipelineVersion } from './utils.js';

export function ema(candles: Candle[], period: number = 20): IndicatorResult<number> {
  const candlesConsumed = candles.length;
  const meta = {
    pipelineVersion: pipelineVersion('ema', { period }),
    candlesConsumed,
  };

  if (candlesConsumed < period) {
    return { value: NaN, metadata: meta };
  }

  const multiplier = 2 / (period + 1);
  const closePrices = candles.map((c) => c.close);

  const initialSlice = closePrices.slice(0, period);
  const initialSum = initialSlice.reduce((a, b) => a + b, 0);
  let emaValue = initialSum / period;

  for (let i = period; i < closePrices.length; i++) {
    emaValue = (closePrices[i] - emaValue) * multiplier + emaValue;
  }

  return { value: emaValue, metadata: meta };
}
