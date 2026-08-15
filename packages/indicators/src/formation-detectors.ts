import type { Candle } from '@trading/core';
import type { FormationOptions, SwingPoint } from './formation-types.js';
import { normalizeFormationOptions } from './formation-swings.js';

export interface FormationResult {
  fired: boolean;
  necklinePrice: number | null;
  necklineSlopePct: number | null;
}

const NOT_FIRED: FormationResult = { fired: false, necklinePrice: null, necklineSlopePct: null };

export function notFired(): FormationResult {
  return NOT_FIRED;
}

/**
 * Every detector anchors to the MOST RECENT pivot in the window. A formation is
 * completed structure that resolves at the last candle, so the swing it resolves
 * is the latest one. This is also what makes the pattern classes mutually
 * exclusive by construction: the most recent pivot is either a high (bearish
 * formations only) or a low (bullish formations only) — never both.
 */

/** Neckline value at the last candle index, extrapolating the line through p1→p2. */
function necklineAtLast(p1: SwingPoint, p2: SwingPoint, candles: Candle[]): number {
  const span = p2.index - p1.index;
  if (span <= 0) return NaN;
  const total = p2.price - p1.price;
  const atLast = p1.price + (total * (candles.length - 1 - p1.index)) / span;
  return atLast;
}

/** Total neckline slope over its span as % of the median close. */
function necklineSlopePct(p1: SwingPoint, p2: SwingPoint, median: number): number {
  if (median <= 0) return NaN;
  return ((p2.price - p1.price) / median) * 100;
}

export function detectHeadAndShoulders(
  candles: Candle[],
  pivots: SwingPoint[],
  median: number,
  opts: FormationOptions,
): FormationResult {
  const o = normalizeFormationOptions(opts);
  if (pivots.length < 5) return NOT_FIRED;
  const rs = pivots[pivots.length - 1];
  const v2 = pivots[pivots.length - 2];
  const head = pivots[pivots.length - 3];
  const v1 = pivots[pivots.length - 4];
  const ls = pivots[pivots.length - 5];
  if (
    rs.type !== 'high' ||
    v2.type !== 'low' ||
    head.type !== 'high' ||
    v1.type !== 'low' ||
    ls.type !== 'high'
  ) {
    return NOT_FIRED;
  }
  const hHead = head.price;
  const hLs = ls.price;
  const hRs = rs.price;
  if (hHead <= hLs || hHead <= hRs) return NOT_FIRED;
  if (((hHead - hLs) / hHead) * 100 < o.headMarginPct) return NOT_FIRED;
  if (((hHead - hRs) / hHead) * 100 < o.headMarginPct) return NOT_FIRED;
  const shoulderBase = Math.max(hLs, hRs);
  if (shoulderBase <= 0) return NOT_FIRED;
  if (Math.abs(hLs - hRs) / shoulderBase > o.shoulderSymmetry) return NOT_FIRED;
  const slopePct = necklineSlopePct(v1, v2, median);
  if (!Number.isFinite(slopePct) || Math.abs(slopePct) > o.necklineSlopePct) return NOT_FIRED;
  const neckline = necklineAtLast(v1, v2, candles);
  if (!Number.isFinite(neckline) || !(candles[candles.length - 1].close < neckline))
    return NOT_FIRED;
  return { fired: true, necklinePrice: neckline, necklineSlopePct: slopePct };
}

export function detectInverseHeadAndShoulders(
  candles: Candle[],
  pivots: SwingPoint[],
  median: number,
  opts: FormationOptions,
): FormationResult {
  const o = normalizeFormationOptions(opts);
  if (pivots.length < 5) return NOT_FIRED;
  const rs = pivots[pivots.length - 1];
  const v2 = pivots[pivots.length - 2];
  const head = pivots[pivots.length - 3];
  const v1 = pivots[pivots.length - 4];
  const ls = pivots[pivots.length - 5];
  if (
    rs.type !== 'low' ||
    v2.type !== 'high' ||
    head.type !== 'low' ||
    v1.type !== 'high' ||
    ls.type !== 'low'
  ) {
    return NOT_FIRED;
  }
  const lHead = head.price;
  const lLs = ls.price;
  const lRs = rs.price;
  if (lHead >= lLs || lHead >= lRs) return NOT_FIRED;
  const shoulderAvg = (lLs + lRs) / 2;
  if (shoulderAvg <= 0) return NOT_FIRED;
  if (((shoulderAvg - lHead) / shoulderAvg) * 100 < o.headMarginPct) return NOT_FIRED;
  if (Math.abs(lLs - lRs) / Math.max(lLs, lRs) > o.shoulderSymmetry) return NOT_FIRED;
  const slopePct = necklineSlopePct(v1, v2, median);
  if (!Number.isFinite(slopePct) || Math.abs(slopePct) > o.necklineSlopePct) return NOT_FIRED;
  const neckline = necklineAtLast(v1, v2, candles);
  if (!Number.isFinite(neckline) || !(candles[candles.length - 1].close > neckline))
    return NOT_FIRED;
  return { fired: true, necklinePrice: neckline, necklineSlopePct: slopePct };
}

export function detectDoubleTop(
  candles: Candle[],
  pivots: SwingPoint[],
  opts: FormationOptions,
): FormationResult {
  const o = normalizeFormationOptions(opts);
  if (pivots.length < 3) return NOT_FIRED;
  const t2 = pivots[pivots.length - 1];
  const valley = pivots[pivots.length - 2];
  const t1 = pivots[pivots.length - 3];
  if (t2.type !== 'high' || valley.type !== 'low' || t1.type !== 'high') return NOT_FIRED;
  const h1 = t1.price;
  const h2 = t2.price;
  const v = valley.price;
  if (v >= h1 || v >= h2) return NOT_FIRED;
  const topAvg = (h1 + h2) / 2;
  if (topAvg <= 0) return NOT_FIRED;
  if (Math.abs(h1 - h2) / topAvg > o.doubleEqualTolerance) return NOT_FIRED;
  if (((topAvg - v) / topAvg) * 100 < o.valleyDepthPct) return NOT_FIRED;
  if (!(candles[candles.length - 1].close < v)) return NOT_FIRED;
  return { fired: true, necklinePrice: v, necklineSlopePct: 0 };
}

export function detectDoubleBottom(
  candles: Candle[],
  pivots: SwingPoint[],
  opts: FormationOptions,
): FormationResult {
  const o = normalizeFormationOptions(opts);
  if (pivots.length < 3) return NOT_FIRED;
  const b2 = pivots[pivots.length - 1];
  const peak = pivots[pivots.length - 2];
  const b1 = pivots[pivots.length - 3];
  if (b2.type !== 'low' || peak.type !== 'high' || b1.type !== 'low') return NOT_FIRED;
  const l1 = b1.price;
  const l2 = b2.price;
  const p = peak.price;
  if (l1 >= p || l2 >= p) return NOT_FIRED;
  const bottomAvg = (l1 + l2) / 2;
  if (bottomAvg <= 0) return NOT_FIRED;
  if (Math.abs(l1 - l2) / bottomAvg > o.doubleEqualTolerance) return NOT_FIRED;
  if (((p - bottomAvg) / bottomAvg) * 100 < o.valleyDepthPct) return NOT_FIRED;
  if (!(candles[candles.length - 1].close > p)) return NOT_FIRED;
  return { fired: true, necklinePrice: p, necklineSlopePct: 0 };
}
