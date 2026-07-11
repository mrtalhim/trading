import { describe, it, expect } from 'vitest';
import type { Candle } from '@trading/core';
import { validateCandles, parseInterval } from '../validator/validator.js';

function makeCandle(overrides: Partial<Candle> & { timestamp: number }): Candle {
  return {
    open: 42000,
    high: 42500,
    low: 41800,
    close: 42300,
    volume: 100,
    ...overrides,
  };
}

describe('parseInterval', () => {
  it('parses known intervals', () => {
    expect(parseInterval('15m')).toBe(900_000);
    expect(parseInterval('1h')).toBe(3_600_000);
    expect(parseInterval('1d')).toBe(86_400_000);
  });

  it('throws on unknown interval', () => {
    expect(() => parseInterval('7m')).toThrow('Unknown interval: 7m');
  });
});

describe('validateCandles', () => {
  it('passes for valid candles', () => {
    const candles = [
      makeCandle({ timestamp: 1000 }),
      makeCandle({ timestamp: 1000 + 900_000 }),
      makeCandle({ timestamp: 1000 + 1800_000 }),
    ];
    const result = validateCandles(candles, '15m');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('passes for empty candle array', () => {
    const result = validateCandles([], '15m');
    expect(result.valid).toBe(true);
  });

  it('detects decreasing timestamps', () => {
    const candles = [makeCandle({ timestamp: 2000 }), makeCandle({ timestamp: 1000 })];
    const result = validateCandles(candles, '15m');
    expect(result.valid).toBe(false);
    expect(result.errors[0].type).toBe('decreasing_timestamp');
  });

  it('detects duplicate timestamps', () => {
    const candles = [makeCandle({ timestamp: 1000 }), makeCandle({ timestamp: 1000 })];
    const result = validateCandles(candles, '15m');
    expect(result.valid).toBe(false);
    expect(result.errors[0].type).toBe('duplicate_timestamp');
  });

  it('detects missing candles (gap)', () => {
    const candles = [
      makeCandle({ timestamp: 1000 }),
      makeCandle({ timestamp: 1000 + 900_000 * 2 }), // skipped one
    ];
    const result = validateCandles(candles, '15m');
    expect(result.valid).toBe(false);
    expect(result.errors[0].type).toBe('missing_candles');
  });

  it('detects high < open', () => {
    const candles = [makeCandle({ timestamp: 1000, high: 41000, open: 42000 })];
    const result = validateCandles(candles, '15m');
    expect(result.valid).toBe(false);
    expect(result.errors[0].type).toBe('invalid_ohlcv');
  });

  it('detects high < close', () => {
    const candles = [makeCandle({ timestamp: 1000, high: 41000, close: 42000 })];
    const result = validateCandles(candles, '15m');
    expect(result.valid).toBe(false);
    expect(result.errors[0].type).toBe('invalid_ohlcv');
  });

  it('detects low > open', () => {
    const candles = [makeCandle({ timestamp: 1000, low: 43000, open: 42000 })];
    const result = validateCandles(candles, '15m');
    expect(result.valid).toBe(false);
    expect(result.errors[0].type).toBe('invalid_ohlcv');
  });

  it('detects low > close', () => {
    const candles = [makeCandle({ timestamp: 1000, low: 43000, close: 42000 })];
    const result = validateCandles(candles, '15m');
    expect(result.valid).toBe(false);
    expect(result.errors[0].type).toBe('invalid_ohlcv');
  });

  it('detects negative volume', () => {
    const candles = [makeCandle({ timestamp: 1000, volume: -10 })];
    const result = validateCandles(candles, '15m');
    expect(result.valid).toBe(false);
    expect(result.errors[0].type).toBe('invalid_ohlcv');
  });

  it('collects multiple errors', () => {
    const candles = [
      makeCandle({ timestamp: 2000, high: 41000, open: 42000 }),
      makeCandle({ timestamp: 1000, low: 43000, open: 42000 }),
    ];
    const result = validateCandles(candles, '15m');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('allows high == open and high == close', () => {
    const candles = [makeCandle({ timestamp: 1000, high: 42000, open: 42000, close: 42000 })];
    const result = validateCandles(candles, '15m');
    expect(result.valid).toBe(true);
  });

  it('allows low == open and low == close', () => {
    const candles = [makeCandle({ timestamp: 1000, low: 42000, open: 42000, close: 42000 })];
    const result = validateCandles(candles, '15m');
    expect(result.valid).toBe(true);
  });
});
