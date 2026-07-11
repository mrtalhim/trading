import type { Candle } from '@trading/core';
import type { IndicatorResult } from '@trading/core';
import { rsi, atr, adx, ema, sma, vwap, pipelineVersion } from '@trading/indicators';
import type { BuiltinIndicator } from './types.js';

type ComputeFn = (window: Candle[], params?: Record<string, unknown>) => IndicatorResult<number>;

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && !Number.isNaN(value) ? value : fallback;
}

export const registry: Record<BuiltinIndicator, ComputeFn> = {
  rsi: (window, params) => rsi(window, num(params?.period, 14)),
  atr: (window, params) => atr(window, num(params?.period, 14)),
  adx: (window, params) => adx(window, num(params?.period, 14)),
  ema: (window, params) => ema(window, num(params?.period, 20)),
  sma: (window, params) => sma(window, num(params?.period, 20)),
  vwap: (window) => vwap(window),
  return: (window, params) => {
    const meta = {
      pipelineVersion: pipelineVersion('return', params ?? {}),
      candlesConsumed: window.length,
    };
    if (window.length < 2) return { value: NaN, metadata: meta };
    return {
      value: window[window.length - 1].close - window[window.length - 2].close,
      metadata: meta,
    };
  },
  logReturn: (window, params) => {
    const meta = {
      pipelineVersion: pipelineVersion('logReturn', params ?? {}),
      candlesConsumed: window.length,
    };
    if (window.length < 2) return { value: NaN, metadata: meta };
    const c0 = window[window.length - 2].close;
    const c1 = window[window.length - 1].close;
    if (c0 <= 0 || c1 <= 0) return { value: NaN, metadata: meta };
    return { value: Math.log(c1 / c0), metadata: meta };
  },
};

export function isBuiltinIndicator(value: string): value is BuiltinIndicator {
  return Object.prototype.hasOwnProperty.call(registry, value);
}
