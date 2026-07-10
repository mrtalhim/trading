import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { sma } from '../sma.js';
import type { Candle } from '@trading/core';

const candles: Candle[] = JSON.parse(readFileSync('tests/fixtures/candles.json', 'utf-8'));

describe('sma', () => {
  it('returns correct SMA(20) for the fixture', () => {
    const result = sma(candles, 20);
    expect(result.value).toBeCloseTo(51365, 1);
  });

  it('returns NaN when insufficient data', () => {
    const result = sma(candles.slice(0, 19), 20);
    expect(result.value).toBeNaN();
  });

  it('is deterministic', () => {
    const a = sma(candles, 14);
    const b = sma(candles, 14);
    expect(a.value).toBe(b.value);
  });

  it('includes metadata with pipelineVersion and candlesConsumed', () => {
    const result = sma(candles, 20);
    expect(result.metadata.pipelineVersion).toBeDefined();
    expect(result.metadata.pipelineVersion.length).toBe(16);
    expect(result.metadata.candlesConsumed).toBe(30);
  });
});
