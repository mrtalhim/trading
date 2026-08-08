import { describe, expect, it } from 'vitest';
import type { Candle } from '@trading/core';
import type { Dataset, DatasetMetadata } from '@trading/datasets';
import {
  BacktestEngine,
  type BacktestConfig,
  type RecordedDecision,
} from '../../apps/backtest/src/index.js';

const START = 1_700_000_000_000;
const INTERVAL_MS = 15 * 60 * 1000;

function candle(idx: number, partial?: Partial<Candle>): Candle {
  return {
    timestamp: START + idx * INTERVAL_MS,
    open: 100,
    high: 104,
    low: 96,
    close: 100,
    volume: 500,
    ...partial,
  };
}

function makeDataset(candles: Candle[]): Dataset {
  const metadata: DatasetMetadata = {
    exchange: 'test',
    pair: 'BTCUSDT',
    interval: '15m',
    timezone: 'UTC',
    source: 'test',
    start: candles[0].timestamp,
    end: candles[candles.length - 1].timestamp,
    candleCount: candles.length,
    checksum: 'test',
    includes: { candles: true, ticker: false, orderbook: false, trades: false },
  };
  return {
    metadata: async () => metadata,
    candles: async function* () {
      for (const c of candles) yield c;
    },
  };
}

function decision(idx: number, action: RecordedDecision['action']): RecordedDecision {
  return { timestamp: candle(idx).timestamp, action, confidence: 0.9 };
}

function makeConfig(
  candles: Candle[],
  decisions: RecordedDecision[],
  enableStops: boolean,
): BacktestConfig {
  return {
    dataset: makeDataset(candles),
    decisions,
    symbol: 'BTC/USDT',
    base: 'BTC',
    quote: 'USDT',
    initialQuote: 10000,
    feeRate: 0,
    sizing: { fraction: 0.2 },
    atrStopMultiplier: 2,
    atrTpMultiplier: 3,
    enableStops,
  };
}

// 14 flat-range warmup candles (high 104 / low 96, close 100) make ATR(14) = 8.
// A long entry at idx 14 closes at 100 → stop = 84, tp = 124 with stopMult 2 / tpMult 3.
const WARMUP_COUNT = 15;
function warmup(): Candle[] {
  return Array.from({ length: WARMUP_COUNT }, (_, i) => candle(i));
}

describe('BacktestEngine ATR stop/take-profit exits (experimental, default off)', () => {
  it('exits a long at the exact stop price when the next candle low crosses it', async () => {
    const candles = [...warmup(), candle(WARMUP_COUNT, { open: 90, high: 90, low: 80, close: 86 })];
    const decisions = [decision(WARMUP_COUNT - 1, 'long')];
    const r = await new BacktestEngine(makeConfig(candles, decisions, true)).run();

    const exit = r.trades.find((t) => t.side === 'sell');
    expect(exit).toBeDefined();
    expect(exit!.price).toBe(84);
    expect(exit!.realizedPnl).toBe(-320);
    expect(exit!.status).toBe('filled');
  });

  it('exits a long at the exact take-profit price when the next candle high crosses it', async () => {
    const candles = [...warmup(), candle(WARMUP_COUNT, { open: 120, high: 130, low: 120, close: 125 })];
    const decisions = [decision(WARMUP_COUNT - 1, 'long')];
    const r = await new BacktestEngine(makeConfig(candles, decisions, true)).run();

    const exit = r.trades.find((t) => t.side === 'sell');
    expect(exit).toBeDefined();
    expect(exit!.price).toBe(124);
    expect(exit!.realizedPnl).toBe(480);
  });

  it('treats both-levels-crossed candles conservatively: stop fires before tp', async () => {
    const candles = [...warmup(), candle(WARMUP_COUNT, { open: 90, high: 130, low: 80, close: 100 })];
    const decisions = [decision(WARMUP_COUNT - 1, 'long')];
    const r = await new BacktestEngine(makeConfig(candles, decisions, true)).run();

    const exit = r.trades.find((t) => t.side === 'sell');
    expect(exit).toBeDefined();
    expect(exit!.price).toBe(84);
  });

  it('is deterministic when stops are enabled', async () => {
    const candles = [...warmup(), candle(WARMUP_COUNT, { open: 90, high: 90, low: 80, close: 86 })];
    const decisions = [decision(WARMUP_COUNT - 1, 'long')];
    const r1 = await new BacktestEngine(makeConfig(candles, decisions, true)).run();
    const r2 = await new BacktestEngine(makeConfig(candles, decisions, true)).run();
    expect(r1.checksum).toBe(r2.checksum);
    expect(r1.trades).toEqual(r2.trades);
  });

  it('leaves the default replay untouched when disabled', async () => {
    const candles = [...warmup(), candle(WARMUP_COUNT, { open: 90, high: 90, low: 80, close: 86 })];
    const decisions = [decision(WARMUP_COUNT - 1, 'long')];
    const off = await new BacktestEngine(makeConfig(candles, decisions, false)).run();
    const explicitOff = await new BacktestEngine(
      makeConfig(candles, decisions, false),
    ).run();
    expect(off.checksum).toBe(explicitOff.checksum);
    expect(off.trades.find((t) => t.side === 'sell')).toBeUndefined();
  });
});
