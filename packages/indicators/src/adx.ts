import type { Candle } from '@trading/core';
import type { IndicatorResult } from '@trading/core';
import { pipelineVersion } from './utils.js';

function directionalMovement(candles: Candle[]): { plusDM: number[]; minusDM: number[] } {
  const plusDM: number[] = [];
  const minusDM: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const upMove = candles[i].high - candles[i - 1].high;
    const downMove = candles[i - 1].low - candles[i].low;

    if (upMove > downMove && upMove > 0) {
      plusDM.push(upMove);
    } else {
      plusDM.push(0);
    }

    if (downMove > upMove && downMove > 0) {
      minusDM.push(downMove);
    } else {
      minusDM.push(0);
    }
  }

  return { plusDM, minusDM };
}

function smooth(values: number[], period: number): number[] {
  const result: number[] = [];
  const initialSum = values.slice(0, period).reduce((a, b) => a + b, 0);
  result.push(initialSum / period);

  for (let i = period; i < values.length; i++) {
    const smoothed = (result[result.length - 1] * (period - 1) + values[i]) / period;
    result.push(smoothed);
  }

  return result;
}

export function adx(candles: Candle[], period: number = 14): IndicatorResult<number> {
  const candlesConsumed = candles.length;
  const meta = {
    pipelineVersion: pipelineVersion('adx', { period }),
    candlesConsumed,
  };

  if (candlesConsumed < 2 * period) {
    return { value: NaN, metadata: meta };
  }

  const { plusDM, minusDM } = directionalMovement(candles);

  const smoothPlusDM = smooth(plusDM, period);
  const smoothMinusDM = smooth(minusDM, period);
  const smoothTR = smooth(
    plusDM.map((_, i) => {
      const idx = i + 1;
      const candle = candles[idx];
      const prevClose = candles[idx - 1].close;
      const hl = candle.high - candle.low;
      const hc = Math.abs(candle.high - prevClose);
      const lc = Math.abs(candle.low - prevClose);
      return Math.max(hl, hc, lc);
    }),
    period,
  );

  const dxValues: number[] = [];
  for (let i = 0; i < smoothPlusDM.length; i++) {
    const plusDI = 100 * (smoothPlusDM[i] / smoothTR[i]);
    const minusDI = 100 * (smoothMinusDM[i] / smoothTR[i]);
    const diSum = plusDI + minusDI;
    if (diSum === 0) {
      dxValues.push(0);
    } else {
      dxValues.push((100 * Math.abs(plusDI - minusDI)) / diSum);
    }
  }

  const adxSum = dxValues.slice(0, period).reduce((a, b) => a + b, 0);
  const adxValue = adxSum / period;

  return { value: adxValue, metadata: meta };
}
