import { describe, expect, it } from 'vitest';
import type { Candle } from '../../packages/core/src/candle.js';
import type { PatternContext } from '../../packages/indicators/src/pattern-types.js';
import { detectPatternContext } from '../../packages/indicators/src/pattern-context.js';

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
  const len = Math.floor(rand.next() * 41);
  const out: Candle[] = [];
  for (let i = 0; i < len; i++) {
    out.push(randomCandle(rand, 1700000000000 + i * 900000));
  }
  return out;
}

type CatName = 'single' | 'double' | 'triple';

const EXCLUSIVE_PAIRS: Array<
  [CatName, keyof PatternContext[CatName], CatName, keyof PatternContext[CatName]]
> = [
  ['single', 'doji', 'single', 'marubozu'],
  ['single', 'hammer', 'single', 'hangingMan'],
  ['single', 'hammer', 'single', 'shootingStar'],
  ['single', 'invertedHammer', 'single', 'hangingMan'],
  ['single', 'invertedHammer', 'single', 'shootingStar'],
  ['double', 'bullishEngulfing', 'double', 'bearishEngulfing'],
  ['double', 'piercingLine', 'double', 'darkCloudCover'],
  ['double', 'bullishHarami', 'double', 'bearishHarami'],
  ['triple', 'morningStar', 'triple', 'eveningStar'],
  ['triple', 'threeWhiteSoldiers', 'triple', 'threeBlackCrows'],
];

describe('pattern boolean property invariants (100k random windows)', () => {
  it('never yields mutually exclusive patterns together, never NaN, never crashes', () => {
    const rand = mulberry32(20260807);
    let crashes = 0;
    let violations = 0;

    for (let i = 0; i < 100_000; i++) {
      const candles = randomWindow(rand);
      let ctx: PatternContext;
      try {
        ctx = detectPatternContext(candles);
      } catch {
        crashes++;
        continue;
      }

      for (const [catA, nameA, catB, nameB] of EXCLUSIVE_PAIRS) {
        const a = (ctx[catA][nameA] as unknown) === true;
        const b = (ctx[catB][nameB] as unknown) === true;
        if (a && b) violations++;
      }

      for (const group of [ctx.single, ctx.double, ctx.triple]) {
        for (const value of Object.values(group)) {
          if (typeof value !== 'boolean') violations++;
        }
      }
      if (typeof ctx.structural.trendStructure !== 'string') violations++;
      if (!/^[0-9a-f]{16}$/.test(ctx.patternVersion)) violations++;
    }

    expect(crashes).toBe(0);
    expect(violations).toBe(0);
  });
});
