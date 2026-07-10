import type { Candle } from '@trading/core';
import type { IndicatorResult } from '@trading/core';
import { pipelineVersion } from './utils.js';

export function vwap(candles: Candle[]): IndicatorResult<number> {
  const candlesConsumed = candles.length;
  const meta = {
    pipelineVersion: pipelineVersion('vwap', {}),
    candlesConsumed,
  };

  if (candlesConsumed === 0) {
    return { value: NaN, metadata: meta };
  }

  let volumeSum = 0;
  let priceVolumeSum = 0;

  for (const c of candles) {
    const typicalPrice = (c.high + c.low + c.close) / 3;
    volumeSum += c.volume;
    priceVolumeSum += typicalPrice * c.volume;
  }

  return { value: priceVolumeSum / volumeSum, metadata: meta };
}
