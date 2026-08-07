import type { Candle } from '@trading/core';

export function range(c: Candle): number {
  return c.high - c.low;
}

export function bodySize(c: Candle): number {
  return Math.abs(c.close - c.open);
}

export function upperWick(c: Candle): number {
  return c.high - Math.max(c.open, c.close);
}

export function lowerWick(c: Candle): number {
  return Math.min(c.open, c.close) - c.low;
}

export function isBullish(c: Candle): boolean {
  return c.close >= c.open;
}

export function isBearish(c: Candle): boolean {
  return c.close <= c.open;
}

export function bodyRegion(c: Candle): { top: number; bottom: number } {
  return {
    top: Math.max(c.open, c.close),
    bottom: Math.min(c.open, c.close),
  };
}
