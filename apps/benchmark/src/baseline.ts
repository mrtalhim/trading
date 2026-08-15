import type { Candle, Action } from '@trading/core';
import type { Dataset } from '@trading/datasets';
import { BacktestEngine, type RecordedDecision } from '@trading/backtest';

/**
 * Deterministic, offline direction generators for the directional-baseline
 * control experiment. Both baselines produce the same `RecordedDecision[]`
 * shape that `backtest --record` writes, so the existing replay/risk/guardrail
 * pipeline consumes them unchanged. No network, no LLM, no `Math.random`.
 */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface RandomStreamOptions {
  seed: number;
  /** Probability of emitting `hold` at each step, to match the real model's observed hold rate. */
  holdProb: number;
  /** Fixed confidence for every decision (clears whatever `minConfidence` the winning config used). */
  confidence: number;
}

/**
 * Baseline A — seeded random direction with a matched hold probability.
 * Deterministic per seed; callers must log the seed used.
 */
export function randomDirectionStream(
  timestamps: number[],
  opts: RandomStreamOptions,
): RecordedDecision[] {
  if (opts.holdProb < 0 || opts.holdProb > 1) {
    throw new Error(`invalid holdProb (expected 0..1): ${opts.holdProb}`);
  }
  if (!(opts.confidence >= 0 && opts.confidence <= 1)) {
    throw new Error(`invalid confidence (expected 0..1): ${opts.confidence}`);
  }
  const rand = mulberry32(opts.seed);
  return timestamps.map((timestamp) => {
    let action: Action;
    if (rand() < opts.holdProb) {
      action = 'hold';
    } else {
      action = rand() < 0.5 ? 'long' : 'short';
    }
    return { timestamp, action, confidence: opts.confidence };
  });
}

export interface MaStreamOptions {
  /** MA period used for the crossover (default 20). */
  period?: number;
  /** Fixed confidence for every decision (default 0.9). */
  confidence?: number;
}

/**
 * Baseline B — trivial deterministic rule: long when `close > MA(period)`,
 * short when `close < MA(period)`, hold on equality or when fewer than
 * `period` candles precede the decision (warmup). Pure function of the candle
 * window; no randomness.
 */
export function maCrossoverStream(
  timestamps: number[],
  candles: Candle[],
  opts: MaStreamOptions = {},
): RecordedDecision[] {
  const period = opts.period ?? 20;
  const confidence = opts.confidence ?? 0.9;

  const sorted = [...candles].sort((a, b) => a.timestamp - b.timestamp);
  const indexByTimestamp = new Map<number, number>();
  for (let i = 0; i < sorted.length; i++) {
    indexByTimestamp.set(sorted[i].timestamp, i);
  }

  return timestamps.map((timestamp) => {
    const idx = indexByTimestamp.get(timestamp);
    if (idx === undefined || idx + 1 < period) {
      return { timestamp, action: 'hold', confidence };
    }
    const closes = sorted.slice(idx + 1 - period, idx + 1).map((c) => c.close);
    const mean = closes.reduce((a, b) => a + b, 0) / closes.length;
    const close = sorted[idx].close;
    const action: Action = close > mean ? 'long' : close < mean ? 'short' : 'hold';
    return { timestamp, action, confidence };
  });
}

export interface FixedBacktestConfig {
  symbol: string;
  base: string;
  quote: string;
  initialQuote: number;
  feeRate: number;
  fraction: number;
  minConfidence: number;
  minVolume: number;
  atrStopMultiplier: number;
  atrTpMultiplier: number;
  enableStops: boolean;
}

export interface FixedBacktestOutcome {
  realizedPnl: number;
  winRate: number;
  trades: number;
  closedTrades: number;
}

/**
 * Runs one replay with risk parameters held fixed (the winning stops-on config
 * from the sweep). Identical to what `sweepConfigs` does per grid cell, but
 * without the grid — reuses the existing engine/guardrail/risk code unchanged.
 */
export async function runFixedBacktest(
  dataset: Dataset,
  decisions: RecordedDecision[],
  config: FixedBacktestConfig,
): Promise<FixedBacktestOutcome> {
  const result = await new BacktestEngine({
    dataset,
    decisions,
    symbol: config.symbol,
    base: config.base,
    quote: config.quote,
    initialQuote: config.initialQuote,
    feeRate: config.feeRate,
    sizing: { fraction: config.fraction },
    atrStopMultiplier: config.atrStopMultiplier,
    atrTpMultiplier: config.atrTpMultiplier,
    enableStops: config.enableStops,
    guardrails: { minConfidence: config.minConfidence, minVolume: config.minVolume },
  }).run();

  const closed = result.trades.filter((t) => t.realizedPnl !== 0);
  const wins = closed.filter((t) => t.realizedPnl > 0).length;
  return {
    realizedPnl: result.realizedPnl,
    winRate: closed.length > 0 ? wins / closed.length : 0,
    trades: result.tradeCount,
    closedTrades: closed.length,
  };
}
