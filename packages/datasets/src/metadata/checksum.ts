import { createHash } from 'node:crypto';
import type { Candle } from '@trading/core';

export function computeChecksum(candles: Candle[]): string {
  const sorted = [...candles].sort((a, b) => a.timestamp - b.timestamp);
  const data = JSON.stringify(sorted);
  return createHash('sha256').update(data).digest('hex').slice(0, 16);
}
