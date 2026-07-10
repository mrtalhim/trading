import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { vwap } from '../vwap.js';
import type { Candle } from '@trading/core';

const candles: Candle[] = JSON.parse(readFileSync('tests/fixtures/candles.json', 'utf-8'));

describe('vwap', () => {
  it('returns correct VWAP for the fixture', () => {
    const result = vwap(candles);
    expect(result.value).toBeCloseTo(51283.02, 1);
  });

  it('returns NaN with zero candles', () => {
    const result = vwap([]);
    expect(result.value).toBeNaN();
  });

  it('is deterministic', () => {
    const a = vwap(candles);
    const b = vwap(candles);
    expect(a.value).toBe(b.value);
  });

  it('includes metadata', () => {
    const result = vwap(candles);
    expect(result.metadata.pipelineVersion).toBeDefined();
    expect(result.metadata.candlesConsumed).toBe(30);
  });
});
