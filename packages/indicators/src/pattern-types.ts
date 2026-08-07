import type { Candle } from '@trading/core';

export type TrendStructure = 'higher_highs_higher_lows' | 'lower_highs_lower_lows' | 'ranging';

export interface PatternOptions {
  /** Candle count used to compute trend structure and swing high/low support/resistance. Default 12. */
  structureLookback?: number;
  /** Distance from a recent swing low/high (as a fraction of the swing range) that still counts as "near". Default 0.15. */
  proximityThreshold?: number;
  /** Minimum candles required before structural detection returns a value instead of `ranging`/false. Default 5. */
  minStructureCandles?: number;
}

export interface SinglePatterns {
  doji: boolean;
  hammer: boolean;
  invertedHammer: boolean;
  hangingMan: boolean;
  shootingStar: boolean;
  marubozu: boolean;
}

export interface DoublePatterns {
  bullishEngulfing: boolean;
  bearishEngulfing: boolean;
  piercingLine: boolean;
  darkCloudCover: boolean;
  bullishHarami: boolean;
  bearishHarami: boolean;
}

export interface TriplePatterns {
  morningStar: boolean;
  eveningStar: boolean;
  threeWhiteSoldiers: boolean;
  threeBlackCrows: boolean;
}

export interface StructuralContext {
  trendStructure: TrendStructure;
  nearSupport: boolean;
  nearResistance: boolean;
}

export interface PatternContext {
  single: SinglePatterns;
  double: DoublePatterns;
  triple: TriplePatterns;
  structural: StructuralContext;
  patternVersion: string;
}

/** A single pure boolean detector over a candle window (analysis always targets the last candle). */
export interface PatternDetector {
  version: string;
  run(candles: Candle[], opts: PatternOptions): boolean;
}

export interface DetectorMap {
  [name: string]: PatternDetector;
}
