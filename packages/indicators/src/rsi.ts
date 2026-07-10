import type { Candle } from '@trading/core';
import type { IndicatorResult } from '@trading/core';
import { pipelineVersion } from './utils.js';

export function rsi(candles: Candle[], period: number = 14): IndicatorResult<number> {
  const candlesConsumed = candles.length;
  const meta = {
    pipelineVersion: pipelineVersion('rsi', { period }),
    candlesConsumed,
  };

  if (candlesConsumed < period + 1) {
    return { value: NaN, metadata: meta };
  }

  const closePrices = candles.map((c) => c.close);
  const changes: number[] = [];
  for (let i = 1; i < closePrices.length; i++) {
    changes.push(closePrices[i] - closePrices[i - 1]);
  }

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    if (changes[i] >= 0) {
      avgGain += changes[i];
    } else {
      avgLoss += Math.abs(changes[i]);
    }
  }
  avgGain /= period;
  avgLoss /= period;

  for (let i = period; i < changes.length; i++) {
    const gain = changes[i] >= 0 ? changes[i] : 0;
    const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) {
    return { value: 100, metadata: meta };
  }

  const rs = avgGain / avgLoss;
  const rsiValue = 100 - 100 / (1 + rs);
  return { value: rsiValue, metadata: meta };
}
