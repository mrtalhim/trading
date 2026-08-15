/**
 * Committed M3.9 parameters (docs/experiments/formations-context.md, fixed
 * 2026-08-15, not tunable after results exist). Our mapping of the
 * Lo, Mamaysky & Wang (2000) formation rules onto discrete candles.
 */
export interface FormationOptions {
  /** Bars of confirmation each side of a swing pivot. Default 2. */
  pivotLeft?: number;
  /** Bars of confirmation each side of a swing pivot. Default 2. */
  pivotRight?: number;
  /** Minimum swing amplitude as % of the window median close. Default 0.5. */
  minSwingSizePct?: number;
  /** Candles below this are insufficient history; formation booleans return false. Default 30. */
  minFormationSpan?: number;
  /** Max relative difference between left/right shoulder pivots. Default 0.05. */
  shoulderSymmetry?: number;
  /** Head must exceed each shoulder by this many percent. Default 2. */
  headMarginPct?: number;
  /** Max absolute neckline slope as % of the median close over its span. Default 5. */
  necklineSlopePct?: number;
  /** Max relative difference between the two tops (or bottoms). Default 0.05. */
  doubleEqualTolerance?: number;
  /** Intervening trough (or peak) must be at least this % away from the tops (or bottoms). Default 2. */
  valleyDepthPct?: number;
}

/** A single pivot: a confirmed local extremum over the pivot window. */
export interface SwingPoint {
  index: number;
  type: 'high' | 'low';
  price: number;
}

export interface FormationContext {
  pivots: { high: number; low: number; total: number };
  headAndShoulders: boolean;
  inverseHeadAndShoulders: boolean;
  doubleTop: boolean;
  doubleBottom: boolean;
  /** Neckline price at the last candle when a neckline formation fired, else null. */
  necklinePrice: number | null;
  /** Neckline slope as % of median close over its span, else null. */
  necklineSlopePct: number | null;
  /** 16-char hex hash over detector version + active options; changes when either changes. */
  formationVersion: string;
}
