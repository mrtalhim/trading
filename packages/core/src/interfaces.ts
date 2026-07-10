import type { Candle } from './candle.js';

export interface IndicatorResult<T> {
  value: T;
  metadata: {
    pipelineVersion: string;
    candlesConsumed: number;
  };
}

export interface IIndicator<TParams, TResult> {
  calculate(candles: Candle[], params: TParams): IndicatorResult<TResult>;
}
