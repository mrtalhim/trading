import { createHash } from 'node:crypto';
import type { Candle } from '@trading/core';
import type { FormationContext, FormationOptions } from './formation-types.js';
import {
  detectDoubleBottom,
  detectDoubleTop,
  detectHeadAndShoulders,
  detectInverseHeadAndShoulders,
  notFired,
  type FormationResult,
} from './formation-detectors.js';
import { detectSwings, medianClose, normalizeFormationOptions } from './formation-swings.js';

const FORMATION_VERSION = '1.0.0';

/**
 * 16-char hex hash over the detector version constant + every active option.
 * Changes when the detector logic version bumps or any committed parameter
 * changes (the `patternVersion` / `ORDERFLOW_VERSION` convention).
 */
export function buildFormationVersion(opts?: FormationOptions): string {
  const o = normalizeFormationOptions(opts);
  const serialized = JSON.stringify({ version: FORMATION_VERSION, opts: o });
  return createHash('sha256').update(serialized).digest('hex').slice(0, 16);
}

function firstFired(results: FormationResult[]): FormationResult {
  return (
    results.find((r) => r.fired) ?? { fired: false, necklinePrice: null, necklineSlopePct: null }
  );
}

export function detectFormationContext(
  candles: Candle[],
  opts?: FormationOptions,
): FormationContext {
  const o = normalizeFormationOptions(opts);
  const pivots = detectSwings(candles, o);
  const median = medianClose(candles);
  const short = candles.length < o.minFormationSpan;

  const headAndShoulders = short ? notFired() : detectHeadAndShoulders(candles, pivots, median, o);
  const inverseHeadAndShoulders = short
    ? notFired()
    : detectInverseHeadAndShoulders(candles, pivots, median, o);
  const doubleTop = short ? notFired() : detectDoubleTop(candles, pivots, o);
  const doubleBottom = short ? notFired() : detectDoubleBottom(candles, pivots, o);

  const neck = firstFired([headAndShoulders, inverseHeadAndShoulders, doubleTop, doubleBottom]);

  return {
    pivots: {
      high: pivots.filter((p) => p.type === 'high').length,
      low: pivots.filter((p) => p.type === 'low').length,
      total: pivots.length,
    },
    headAndShoulders: headAndShoulders.fired,
    inverseHeadAndShoulders: inverseHeadAndShoulders.fired,
    doubleTop: doubleTop.fired,
    doubleBottom: doubleBottom.fired,
    necklinePrice: neck.necklinePrice,
    necklineSlopePct: neck.necklineSlopePct,
    formationVersion: buildFormationVersion(opts),
  };
}
