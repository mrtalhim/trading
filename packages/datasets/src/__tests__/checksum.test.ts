import { describe, it, expect } from 'vitest';
import type { Candle } from '@trading/core';
import { computeChecksum } from '../metadata/checksum.js';

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

describe('computeChecksum', () => {
  it('returns a 16-char hex string', () => {
    const checksum = computeChecksum([makeCandle({ timestamp: 1 })]);
    expect(checksum).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is deterministic for same input', () => {
    const candles = [makeCandle({ timestamp: 1 }), makeCandle({ timestamp: 2 })];
    expect(computeChecksum(candles)).toBe(computeChecksum(candles));
  });

  it('is order-independent', () => {
    const a = [makeCandle({ timestamp: 1 }), makeCandle({ timestamp: 2 })];
    const b = [makeCandle({ timestamp: 2 }), makeCandle({ timestamp: 1 })];
    expect(computeChecksum(a)).toBe(computeChecksum(b));
  });

  it('differs for different data', () => {
    const a = [makeCandle({ timestamp: 1, close: 42000 })];
    const b = [makeCandle({ timestamp: 1, close: 43000 })];
    expect(computeChecksum(a)).not.toBe(computeChecksum(b));
  });

  it('returns same checksum for empty array', () => {
    expect(computeChecksum([])).toBe(computeChecksum([]));
  });
});
