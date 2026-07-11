import type { Candle } from '@trading/core';
import type { DatasetMetadata } from '@trading/datasets';

export type BuiltinIndicator =
  'rsi' | 'atr' | 'adx' | 'ema' | 'sma' | 'vwap' | 'return' | 'logReturn';

export interface FeatureSpec {
  name: string;
  indicator: BuiltinIndicator;
  params?: Record<string, unknown>;
}

export interface FeatureRow {
  index: number;
  candle: Candle;
  features: Record<string, number>;
  insufficient: string[];
  metadata: {
    candlesConsumed: number;
  };
}

export interface FeatureMetadata {
  pipelineVersion: string;
  source: DatasetMetadata;
  features: FeatureSpec[];
  candleCount: number;
  start: number;
  end: number;
  checksum: string;
}
