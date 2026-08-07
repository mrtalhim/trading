import { describe, expect, it } from 'vitest';
import { buildPatternVersion, detectPatternContext } from '../pattern-context.js';
import { makeCandle } from './pattern-helpers.js';

const SAMPLE = [
  makeCandle(100, 104, 96, 102, 1000),
  makeCandle(102, 106, 98, 104, 1000),
  makeCandle(104, 108, 100, 106, 1000),
  makeCandle(106, 110, 102, 108, 1000),
];

describe('pattern context', () => {
  it('is deterministic: same candles, same output', () => {
    const a = detectPatternContext(SAMPLE);
    const b = detectPatternContext(SAMPLE);
    expect(a).toEqual(b);
    expect(a.patternVersion).toBe(b.patternVersion);
  });

  it('has a 16-char hex patternVersion', () => {
    const ctx = detectPatternContext(SAMPLE);
    expect(ctx.patternVersion).toMatch(/^[0-9a-f]{16}$/);
  });

  it('changes patternVersion when detection logic versions change', () => {
    const baseline = buildPatternVersion();
    expect(baseline).toHaveLength(16);
    expect(baseline).not.toBe(buildPatternVersion({ proximityThreshold: 0.3 }));
  });

  it('never crashes on empty or single-candle input', () => {
    const empty = detectPatternContext([]);
    expect(empty.single.doji).toBe(false);
    expect(empty.structural.trendStructure).toBe('ranging');
    expect(empty.patternVersion).toMatch(/^[0-9a-f]{16}$/);

    const single = detectPatternContext([SAMPLE[0]]);
    expect(single.single.doji).toBe(false);
  });
});
