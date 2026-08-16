/**
 * Regime-adaptive ATR stop/TP multipliers (pre-registered experiment
 * `docs/experiments/adaptive-atr-multiplier.md`).
 *
 * At each entry, the current ATR(14) is ranked against the trailing
 * `ADAPTIVE_STATE_WINDOW` candle values (the same ATR series the engine already
 * computes). A rank at/above the 75th percentile = expanding volatility →
 * wider stop/TP; at/below the 25th percentile = contracting volatility →
 * tighter stop/TP; otherwise neutral. Deterministic, causal (only candles up to
 * and including the entry candle), and default-off.
 */

export const ADAPTIVE_STATE_WINDOW = 96;
export const ADAPTIVE_STATE_MIN_VALUES = 15;
export const ADAPTIVE_STATE_P_HIGH = 0.75;
export const ADAPTIVE_STATE_P_LOW = 0.25;

export type AdaptiveMultiplierState = 'expanding' | 'neutral' | 'contracting';

export interface AdaptiveMultiplierSelection {
  state: AdaptiveMultiplierState;
  stopMult: number;
  tpMult: number;
}

export const ADAPTIVE_MULTIPLIERS: Record<
  AdaptiveMultiplierState,
  { stopMult: number; tpMult: number }
> = {
  expanding: { stopMult: 3, tpMult: 3 },
  neutral: { stopMult: 2, tpMult: 3 },
  contracting: { stopMult: 1, tpMult: 2 },
};

export function selectAdaptiveMultipliers(
  atrWindow: number[],
  atr: number,
): AdaptiveMultiplierSelection {
  if (atrWindow.length < ADAPTIVE_STATE_MIN_VALUES || !Number.isFinite(atr) || atr <= 0) {
    return { state: 'neutral', ...ADAPTIVE_MULTIPLIERS.neutral };
  }
  const atOrBelow = atrWindow.filter((v) => v <= atr).length;
  const p = atOrBelow / atrWindow.length;
  if (p >= ADAPTIVE_STATE_P_HIGH) {
    return { state: 'expanding', ...ADAPTIVE_MULTIPLIERS.expanding };
  }
  if (p <= ADAPTIVE_STATE_P_LOW) {
    return { state: 'contracting', ...ADAPTIVE_MULTIPLIERS.contracting };
  }
  return { state: 'neutral', ...ADAPTIVE_MULTIPLIERS.neutral };
}
