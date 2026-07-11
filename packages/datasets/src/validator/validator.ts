import type { Candle } from '@trading/core';

export interface ValidationError {
  type:
    | 'missing_candles'
    | 'duplicate_timestamp'
    | 'decreasing_timestamp'
    | 'invalid_ohlcv'
    | 'interval_inconsistency';
  message: string;
  candle?: { timestamp: number; index: number };
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

const INTERVAL_MS: Record<string, number> = {
  '1m': 60_000,
  '3m': 180_000,
  '5m': 300_000,
  '15m': 900_000,
  '30m': 1_800_000,
  '1h': 3_600_000,
  '2h': 7_200_000,
  '4h': 14_400_000,
  '6h': 21_600_000,
  '8h': 28_800_000,
  '12h': 43_200_000,
  '1d': 86_400_000,
};

export function parseInterval(interval: string): number {
  const ms = INTERVAL_MS[interval];
  if (ms === undefined) {
    throw new Error(`Unknown interval: ${interval}`);
  }
  return ms;
}

export function validateCandles(candles: Candle[], interval: string): ValidationResult {
  const errors: ValidationError[] = [];
  const intervalMs = parseInterval(interval);

  if (candles.length === 0) {
    return { valid: true, errors: [] };
  }

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];

    if (c.high < c.open || c.high < c.close) {
      errors.push({
        type: 'invalid_ohlcv',
        message: `Candle at index ${i}: high (${c.high}) < open (${c.open}) or close (${c.close})`,
        candle: { timestamp: c.timestamp, index: i },
      });
    }

    if (c.low > c.open || c.low > c.close) {
      errors.push({
        type: 'invalid_ohlcv',
        message: `Candle at index ${i}: low (${c.low}) > open (${c.open}) or close (${c.close})`,
        candle: { timestamp: c.timestamp, index: i },
      });
    }

    if (c.volume < 0) {
      errors.push({
        type: 'invalid_ohlcv',
        message: `Candle at index ${i}: negative volume (${c.volume})`,
        candle: { timestamp: c.timestamp, index: i },
      });
    }

    if (i > 0) {
      const prev = candles[i - 1];
      if (c.timestamp <= prev.timestamp) {
        errors.push({
          type: c.timestamp === prev.timestamp ? 'duplicate_timestamp' : 'decreasing_timestamp',
          message: `Candle at index ${i}: timestamp (${c.timestamp}) <= previous (${prev.timestamp})`,
          candle: { timestamp: c.timestamp, index: i },
        });
      } else {
        const gap = c.timestamp - prev.timestamp;
        if (gap !== intervalMs) {
          errors.push({
            type: 'missing_candles',
            message: `Candle at index ${i}: gap (${gap}ms) != expected interval (${intervalMs}ms)`,
            candle: { timestamp: c.timestamp, index: i },
          });
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
