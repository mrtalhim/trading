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
  riskParameterMode: BacktestConfig['riskParameterMode'],
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
    enableStops: true,
    riskParameterMode,
  };
}

// ATR(14) on a flat range-r series equals r (TR = range = |high-low|). So a
// phase of 120 range-2 candles gives ATR 2, then 30 range-20 candles ramps
// ATR(14) to 20. Entering on the last candle ranks the current ATR within the
// trailing 96-value window.
function rangePhase(count: number, range: number): Candle[] {
  return Array.from({ length: count }, (_, i) =>
    candle(i, { high: 100 + range / 2, low: 100 - range / 2, open: 100, close: 100 }),
  );
}

function shiftTimestamps(candles: Candle[], offset: number): Candle[] {
  return candles.map((c, i) => ({ ...c, timestamp: START + (offset + i) * INTERVAL_MS }));
}

// Wilder ATR(14), mirroring packages/indicators/src/atr.ts exactly. Result[i]
// is the ATR available AT candle i (NaN for the first 14 candles).
function atrSeries(candles: Candle[]): number[] {
  const result: number[] = new Array(candles.length).fill(Number.NaN);
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prevClose = candles[i - 1].close;
    trs.push(Math.max(c.high - c.low, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose)));
  }
  if (trs.length < 14) return result;
  let v = trs.slice(0, 14).reduce((a, b) => a + b, 0) / 14;
  result[14] = v;
  for (let i = 14; i < trs.length; i++) {
    v = (v * 13 + trs[i]) / 14;
    result[i + 1] = v;
  }
  return result;
}

describe('BacktestEngine regime-adaptive ATR multipliers (experimental, default off)', () => {
  it('expanding state (ATR at/above 75th pct) uses stopMult 3 / tpMult 3', async () => {
    const low = rangePhase(120, 8);
    const high = rangePhase(30, 20);
    const candles = [
      ...low,
      ...shiftTimestamps(high, 120),
      candle(150, { open: 100, high: 100, low: 30, close: 40 }),
    ];
    const decisions = [decision(149, 'long')];
    const r = await new BacktestEngine(makeConfig(candles, decisions, 'adaptive')).run();

    const atrAtEntry = atrSeries(candles)[149];
    expect(atrAtEntry).toBeGreaterThan(8); // ramp has actually lifted ATR
    const exit = r.trades.find((t) => t.side === 'sell');
    expect(exit).toBeDefined();
    // expanding → stopMult 3 / tpMult 3; entry at close 100, low 30 crosses the stop first
    expect(exit!.price).toBeCloseTo(100 - atrAtEntry * 3, 6);
  });

  it('contracting state (ATR at/below 25th pct) uses stopMult 1 / tpMult 2', async () => {
    const wide = rangePhase(120, 20);
    const narrow = rangePhase(30, 2);
    const candles = [
      ...wide,
      ...shiftTimestamps(narrow, 120),
      candle(150, { open: 120, high: 130, low: 120, close: 125 }),
    ];
    const decisions = [decision(149, 'long')];
    const r = await new BacktestEngine(makeConfig(candles, decisions, 'adaptive')).run();

    const atrAtEntry = atrSeries(candles)[149];
    expect(atrAtEntry).toBeLessThan(20); // the squeeze has actually pulled ATR down
    const exit = r.trades.find((t) => t.side === 'sell');
    expect(exit).toBeDefined();
    // contracting → stopMult 1 / tpMult 2; high 130 crosses the TP first
    expect(exit!.price).toBeCloseTo(100 + atrAtEntry * 2, 6);
  });

  it('warmup (< 15 ATR values) falls back to the fixed 2/3 levels', async () => {
    const candles = [
      ...Array.from({ length: 15 }, (_, i) => candle(i)),
      candle(15, { open: 90, high: 90, low: 80, close: 86 }),
    ];
    const decisions = [decision(14, 'long')];
    const r = await new BacktestEngine(makeConfig(candles, decisions, 'adaptive')).run();

    const exit = r.trades.find((t) => t.side === 'sell');
    expect(exit).toBeDefined();
    expect(exit!.price).toBe(84);
  });

  it('is deterministic when adaptive mode is on', async () => {
    const low = rangePhase(120, 2);
    const high = rangePhase(30, 20);
    const candles = [...low, ...shiftTimestamps(high, 120)];
    const decisions = [decision(149, 'long')];
    const r1 = await new BacktestEngine(makeConfig(candles, decisions, 'adaptive')).run();
    const r2 = await new BacktestEngine(makeConfig(candles, decisions, 'adaptive')).run();
    expect(r1.checksum).toBe(r2.checksum);
    expect(r1.trades).toEqual(r2.trades);
  });

  it('leaves the default replay untouched when stops are disabled', async () => {
    const candles = Array.from({ length: 15 }, (_, i) => candle(i));
    const decisions = [decision(14, 'long')];
    const cfg = makeConfig(candles, decisions, 'adaptive');
    const off = await new BacktestEngine({ ...cfg, enableStops: false }).run();
    expect(off.trades.find((t) => t.side === 'sell')).toBeUndefined();
  });

  it('reports the adaptive state distribution per entry', async () => {
    const low = rangePhase(120, 8);
    const high = rangePhase(30, 20);
    const candles = [
      ...low,
      ...shiftTimestamps(high, 120),
      candle(150, { open: 100, high: 100, low: 30, close: 40 }),
    ];
    const decisions = [decision(149, 'long')];
    const r = await new BacktestEngine(makeConfig(candles, decisions, 'adaptive')).run();
    expect(r.adaptiveStates).toEqual({ expanding: 1, neutral: 0, contracting: 0 });
  });

  it('does not report adaptive states in fixed mode', async () => {
    const candles = Array.from({ length: 15 }, (_, i) => candle(i));
    const decisions = [decision(14, 'long')];
    const r = await new BacktestEngine(makeConfig(candles, decisions, 'fixed')).run();
    expect(r.adaptiveStates).toBeUndefined();
  });
});
