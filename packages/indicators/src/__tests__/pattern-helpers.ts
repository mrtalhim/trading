import type { Candle } from '@trading/core';

let seq = 0;

export function makeCandle(
  open: number,
  high: number,
  low: number,
  close: number,
  volume = 1000,
): Candle {
  return {
    timestamp: 1700000000000 + seq++ * 900000,
    open,
    high,
    low,
    close,
    volume,
  };
}

export function resetSeq(): void {
  seq = 0;
}

export function downtrend(n: number, start: number, step: number): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < n; i++) {
    const c = start - step * i;
    out.push(makeCandle(c, c + 8, c - 8, c - step, 1000));
  }
  return out;
}

export function uptrend(n: number, start: number, step: number): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < n; i++) {
    const c = start + step * i;
    out.push(makeCandle(c, c + 8, c - 8, c + step, 1000));
  }
  return out;
}
