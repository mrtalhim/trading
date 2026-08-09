import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import type { Candle } from '../../packages/core/src/candle.js';
import { JsonlLoader, type Dataset } from '../../packages/datasets/src/index.js';
import { loadDecisions } from '../../apps/backtest/src/index.js';
import {
  mulberry32,
  randomDirectionStream,
  maCrossoverStream,
  runFixedBacktest,
} from '../../apps/benchmark/src/baseline.js';

const GOLDEN = join(process.cwd(), 'datasets', 'golden', 'btc_15m');
const DECISIONS = join(process.cwd(), 'tests', 'replay', 'fixtures', 'btc-decisions.jsonl');

function mkCandles(closes: number[]): Candle[] {
  return closes.map((close, i) => ({
    timestamp: 1_000_000 + i * 60_000,
    open: close,
    high: close,
    low: close,
    close,
    volume: 1,
  }));
}

function fakeDataset(candles: Candle[]): Dataset {
  return {
    metadata: async () => ({
      exchange: 'test',
      pair: 'TEST/USDT',
      interval: '1m',
      timezone: 'UTC',
      source: 'synthetic',
      start: candles[0].timestamp,
      end: candles[candles.length - 1].timestamp,
      candleCount: candles.length,
      checksum: 'test',
      includes: { candles: true, ticker: false, orderbook: false, trades: false },
    }),
    candles: async function* () {
      for (const c of candles) yield c;
    },
  };
}

describe('mulberry32 (seeded PRNG)', () => {
  it('is deterministic per seed and differs across seeds', () => {
    const a1 = Array.from({ length: 20 }, mulberry32(7));
    const a2 = Array.from({ length: 20 }, mulberry32(7));
    const b = Array.from({ length: 20 }, mulberry32(8));
    expect(a1).toEqual(a2);
    expect(a1).not.toEqual(b);
  });

  it('emits floats in [0, 1)', () => {
    for (const v of Array.from({ length: 1000 }, mulberry32(42))) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('randomDirectionStream (Baseline A)', () => {
  const timestamps = Array.from({ length: 100 }, (_, i) => 1_000_000 + i * 60_000);

  it('is deterministic per seed and differs across seeds', () => {
    const opts = { seed: 11, holdProb: 0.2, confidence: 0.9 };
    expect(randomDirectionStream(timestamps, opts)).toEqual(randomDirectionStream(timestamps, opts));
    expect(randomDirectionStream(timestamps, opts)).not.toEqual(
      randomDirectionStream(timestamps, { ...opts, seed: 12 }),
    );
  });

  it('preserves the decision timestamps 1:1 with the input', () => {
    const stream = randomDirectionStream(timestamps, { seed: 1, holdProb: 0.2, confidence: 0.9 });
    expect(stream.map((d) => d.timestamp)).toEqual(timestamps);
  });

  it('only emits {long, short, hold} at the fixed confidence', () => {
    for (const d of randomDirectionStream(timestamps, { seed: 1, holdProb: 0.2, confidence: 0.9 })) {
      expect(['long', 'short', 'hold']).toContain(d.action);
      expect(d.confidence).toBe(0.9);
    }
  });

  it('matches the requested hold probability on a long stream', () => {
    const many = Array.from({ length: 5000 }, (_, i) => 1_000_000 + i * 60_000);
    const stream = randomDirectionStream(many, { seed: 3, holdProb: 0.2, confidence: 0.9 });
    const holds = stream.filter((d) => d.action === 'hold').length;
    const fraction = holds / stream.length;
    expect(fraction).toBeGreaterThan(0.15);
    expect(fraction).toBeLessThan(0.25);
  });

  it('degenerates correctly at holdProb 0 and 1', () => {
    const none = randomDirectionStream(timestamps, { seed: 1, holdProb: 0, confidence: 0.9 });
    expect(none.every((d) => d.action !== 'hold')).toBe(true);
    const all = randomDirectionStream(timestamps, { seed: 1, holdProb: 1, confidence: 0.9 });
    expect(all.every((d) => d.action === 'hold')).toBe(true);
  });

  it('rejects invalid hold probability', () => {
    expect(() =>
      randomDirectionStream(timestamps, { seed: 1, holdProb: -0.1, confidence: 0.9 }),
    ).toThrow();
    expect(() =>
      randomDirectionStream(timestamps, { seed: 1, holdProb: 1.1, confidence: 0.9 }),
    ).toThrow();
  });
});

describe('maCrossoverStream (Baseline B)', () => {
  it('goes long on a rising series once enough history exists', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i);
    const candles = mkCandles(closes);
    const stream = maCrossoverStream([candles[25].timestamp], candles, { period: 20 });
    expect(stream).toHaveLength(1);
    expect(stream[0].action).toBe('long');
    expect(stream[0].confidence).toBe(0.9);
  });

  it('goes short on a falling series', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 200 - i);
    const candles = mkCandles(closes);
    const stream = maCrossoverStream([candles[25].timestamp], candles, { period: 20 });
    expect(stream[0].action).toBe('short');
  });

  it('holds when close equals the mean (flat series)', () => {
    const closes = Array.from({ length: 30 }, () => 100);
    const candles = mkCandles(closes);
    const stream = maCrossoverStream([candles[25].timestamp], candles, { period: 20 });
    expect(stream[0].action).toBe('hold');
  });

  it('holds during warmup when fewer than `period` candles precede the decision', () => {
    const candles = mkCandles(Array.from({ length: 10 }, (_, i) => 100 + i));
    const stream = maCrossoverStream([candles[9].timestamp], candles, { period: 20 });
    expect(stream[0].action).toBe('hold');
  });

  it('holds when the decision timestamp is not a candle timestamp', () => {
    const candles = mkCandles(Array.from({ length: 30 }, (_, i) => 100 + i));
    const stream = maCrossoverStream([999_999_999], candles, { period: 20 });
    expect(stream[0].action).toBe('hold');
  });

  it('is deterministic and preserves timestamps', () => {
    const candles = mkCandles(Array.from({ length: 30 }, (_, i) => 100 + i));
    const tss = candles.slice(19).map((c) => c.timestamp);
    expect(maCrossoverStream(tss, candles, { period: 20 })).toEqual(
      maCrossoverStream(tss, candles, { period: 20 }),
    );
    expect(maCrossoverStream(tss, candles, { period: 20 }).map((d) => d.timestamp)).toEqual(tss);
  });
});

describe('runFixedBacktest', () => {
  const FIXED = {
    symbol: 'BTC/USDT',
    base: 'BTC',
    quote: 'USDT',
    initialQuote: 10000,
    feeRate: 0,
    fraction: 0.1,
    minConfidence: 0.5,
    minVolume: 0,
    atrStopMultiplier: 2,
    atrTpMultiplier: 3,
    enableStops: true,
  };

  it('is deterministic: identical inputs produce identical outcomes', async () => {
    const dataset = new JsonlLoader(GOLDEN);
    const decisions = await loadDecisions(DECISIONS);
    const a = await runFixedBacktest(dataset, decisions, FIXED);
    const b = await runFixedBacktest(dataset, decisions, FIXED);
    expect(a).toEqual(b);
  });

  it('returns finite numerics with closed trades at most trade count', async () => {
    const dataset = new JsonlLoader(GOLDEN);
    const decisions = await loadDecisions(DECISIONS);
    const out = await runFixedBacktest(dataset, decisions, FIXED);
    expect(Number.isFinite(out.realizedPnl)).toBe(true);
    expect(Number.isFinite(out.winRate)).toBe(true);
    expect(out.winRate).toBeGreaterThanOrEqual(0);
    expect(out.winRate).toBeLessThanOrEqual(1);
    expect(out.closedTrades).toBeGreaterThanOrEqual(0);
    expect(out.closedTrades).toBeLessThanOrEqual(out.trades);
  });

  it('closes through a stop intrabar when stops are on, and not when off', async () => {
    // 20 rising candles (ATR ~1.5), one high candle, then a crash below the
    // 2x ATR stop of the long entry at close 120.
    const closes = [...Array.from({ length: 20 }, (_, i) => 100 + i), 120, 100];
    const candles = closes.map((close, i) => ({
      timestamp: i * 1000,
      open: close,
      high: close + 0.5,
      low: close - 0.5,
      close,
      volume: 1,
    }));
    const dataset = fakeDataset(candles);
    const decisions = [{ timestamp: 20_000, action: 'long' as const, confidence: 0.9 }];
    const cfg = { ...FIXED, symbol: 'TEST/USDT', base: 'TEST', quote: 'USDT', minVolume: 0 };

    const on = await runFixedBacktest(dataset, decisions, { ...cfg, enableStops: true });
    const off = await runFixedBacktest(dataset, decisions, { ...cfg, enableStops: false });

    expect(on.trades).toBe(2); // open + stop close
    expect(on.closedTrades).toBe(1);
    expect(on.realizedPnl).toBeLessThan(0); // stopped out below entry
    expect(off.trades).toBe(1); // open only, never closed
    expect(off.closedTrades).toBe(0);
  });
});
