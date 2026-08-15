import type { Candle } from '@trading/core';
import type { FormationOptions, SwingPoint } from './formation-types.js';

export const DEFAULT_FORMATION_OPTIONS: Required<FormationOptions> = {
  pivotLeft: 2,
  pivotRight: 2,
  minSwingSizePct: 0.5,
  minFormationSpan: 30,
  shoulderSymmetry: 0.05,
  headMarginPct: 2,
  necklineSlopePct: 5,
  doubleEqualTolerance: 0.05,
  valleyDepthPct: 2,
};

export function normalizeFormationOptions(opts?: FormationOptions): Required<FormationOptions> {
  return { ...DEFAULT_FORMATION_OPTIONS, ...opts };
}

export function medianClose(candles: Candle[]): number {
  if (candles.length === 0) return NaN;
  const closes = candles.map((c) => c.close).sort((a, b) => a - b);
  const mid = Math.floor(closes.length / 2);
  return closes.length % 2 === 0 ? (closes[mid - 1] + closes[mid]) / 2 : closes[mid];
}

/**
 * Raw fractal pivots: a swing high at `i` is strictly taller than the highs of
 * the `left` bars before and `right` bars after it (swing low mirrors on `low`).
 * Flat tops produce no pivot (strict comparison). Deterministic.
 */
export function rawPivots(candles: Candle[], left: number, right: number): SwingPoint[] {
  const out: SwingPoint[] = [];
  for (let i = left; i < candles.length - right; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    let isHigh = true;
    let isLow = true;
    for (let j = i - left; j <= i + right; j++) {
      if (j === i) continue;
      if (candles[j].high >= high) isHigh = false;
      if (candles[j].low <= low) isLow = false;
    }
    if (isHigh) out.push({ index: i, type: 'high', price: high });
    else if (isLow) out.push({ index: i, type: 'low', price: low });
  }
  return out;
}

/**
 * Suppress micro-swings (noise): a pivot is retained only when its price differs
 * from both adjacent pivots by at least `minSwing`. A flat ±0.5%-oscillation
 * market yields no pivots at all, so no noise formation can fire.
 */
export function filterByMinSwing(pivots: SwingPoint[], minSwing: number): SwingPoint[] {
  if (pivots.length <= 2) return pivots;
  const keep: SwingPoint[] = [pivots[0]];
  for (let i = 1; i < pivots.length - 1; i++) {
    const before = Math.abs(pivots[i].price - keep[keep.length - 1].price) >= minSwing;
    const after = Math.abs(pivots[i + 1].price - pivots[i].price) >= minSwing;
    if (before && after) keep.push(pivots[i]);
  }
  if (Math.abs(pivots[pivots.length - 1].price - keep[keep.length - 1].price) >= minSwing) {
    keep.push(pivots[pivots.length - 1]);
  }
  return keep;
}

/**
 * Swing-point detection (the M3.9 primitive every formation detector builds on).
 * Fractal pivots over the committed window, then the min-swing noise filter.
 * Never throws; empty input and sub-window histories return [].
 */
export function detectSwings(candles: Candle[], opts?: FormationOptions): SwingPoint[] {
  const o = normalizeFormationOptions(opts);
  if (candles.length < 2) return [];
  const raw = rawPivots(candles, o.pivotLeft, o.pivotRight);
  const median = medianClose(candles);
  if (!Number.isFinite(median) || median <= 0 || raw.length === 0) return [];
  return filterByMinSwing(raw, (o.minSwingSizePct / 100) * median);
}
