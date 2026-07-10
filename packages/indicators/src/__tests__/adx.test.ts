import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { adx } from '../adx.js';
import type { Candle } from '@trading/core';

const candles: Candle[] = JSON.parse(readFileSync('tests/fixtures/candles.json', 'utf-8'));

describe('adx', () => {
  it('returns correct ADX(14) for the fixture', () => {
    const result = adx(candles, 14);
    expect(result.value).toBeCloseTo(19.95, 1);
  });

  it('returns NaN with insufficient data (needs 2 * period)', () => {
    const result = adx(candles.slice(0, 27), 14);
    expect(result.value).toBeNaN();
  });

  it('is deterministic', () => {
    const a = adx(candles, 14);
    const b = adx(candles, 14);
    expect(a.value).toBe(b.value);
  });

  it('includes metadata', () => {
    const result = adx(candles, 14);
    expect(result.metadata.pipelineVersion).toBeDefined();
    expect(result.metadata.candlesConsumed).toBe(30);
  });
});
