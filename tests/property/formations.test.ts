import { describe, expect, it } from 'vitest';
import type { Candle } from '../../packages/core/src/candle.js';
import { detectFormationContext } from '../../packages/indicators/src/formation-context.js';

interface Rand {
  next(): number;
}

function mulberry32(seed: number): Rand {
  let a = seed >>> 0;
  return {
    next(): number {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

function randomCandle(rand: Rand, ts: number): Candle {
  const open = 100 + rand.next() * 30;
  const close = open + (rand.next() - 0.5) * 8;
  const high = Math.max(open, close) + rand.next() * 6;
  const low = Math.min(open, close) - rand.next() * 6;
  return { timestamp: ts, open, high, low, close, volume: rand.next() * 1000 };
}

function randomWindow(rand: Rand): Candle[] {
  const len = Math.floor(rand.next() * 101);
  const out: Candle[] = [];
  for (let i = 0; i < len; i++) {
    out.push(randomCandle(rand, 1700000000000 + i * 900000));
  }
  return out;
}

describe('formation boolean property invariants (100k random windows)', () => {
  it('never yields mutually exclusive formations together, no NaN, never crashes', () => {
    const rand = mulberry32(20260815);
    let crashes = 0;
    let violations = 0;

    for (let i = 0; i < 100_000; i++) {
      const candles = randomWindow(rand);
      let ctx;
      try {
        ctx = detectFormationContext(candles);
      } catch {
        crashes++;
        continue;
      }

      // Mutual exclusivity is guaranteed by construction (the detectors anchor
      // to the most recent pivot: a high can only complete a bearish formation,
      // a low only a bullish one) — the property test locks it in anyway.
      if (ctx.doubleTop && ctx.doubleBottom) violations++;
      if (ctx.headAndShoulders && ctx.inverseHeadAndShoulders) violations++;

      for (const v of [
        ctx.headAndShoulders,
        ctx.inverseHeadAndShoulders,
        ctx.doubleTop,
        ctx.doubleBottom,
      ]) {
        if (typeof v !== 'boolean') violations++;
      }

      // Self-consistency: a fired formation implies the confirmation rule held.
      const lastClose = candles[candles.length - 1]?.close ?? NaN;
      if (ctx.headAndShoulders && !(ctx.necklinePrice !== null && lastClose < ctx.necklinePrice)) {
        violations++;
      }
      if (
        ctx.inverseHeadAndShoulders &&
        !(ctx.necklinePrice !== null && lastClose > ctx.necklinePrice)
      ) {
        violations++;
      }
      if (ctx.doubleTop && !(ctx.necklinePrice !== null && lastClose < ctx.necklinePrice)) {
        violations++;
      }
      if (ctx.doubleBottom && !(ctx.necklinePrice !== null && lastClose > ctx.necklinePrice)) {
        violations++;
      }

      // Neckline fields: real number when a neckline formation fired, else null.
      const fired =
        ctx.headAndShoulders || ctx.inverseHeadAndShoulders || ctx.doubleTop || ctx.doubleBottom;
      if (fired) {
        if (ctx.necklinePrice === null || !Number.isFinite(ctx.necklinePrice)) violations++;
      } else if (ctx.necklinePrice !== null || ctx.necklineSlopePct !== null) {
        violations++;
      }

      // Windows shorter than the committed minimum are always all-false.
      if (candles.length < 30 && fired) violations++;
      if (candles.length < 2 && ctx.pivots.total !== 0) violations++;

      if (!/^[0-9a-f]{16}$/.test(ctx.formationVersion)) violations++;
      if (
        ctx.pivots.high < 0 ||
        ctx.pivots.low < 0 ||
        ctx.pivots.total !== ctx.pivots.high + ctx.pivots.low
      ) {
        violations++;
      }
    }

    expect(crashes).toBe(0);
    expect(violations).toBe(0);
  });
});
