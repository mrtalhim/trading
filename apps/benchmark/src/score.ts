import type { Dataset } from '@trading/datasets';
import { BacktestEngine, type BacktestResult } from '@trading/backtest';
import type { ProbeResult } from './probe.js';

export interface ScoreOptions {
  symbol: string;
  initialQuote: number;
  feeRate: number;
  fraction: number;
  atrStopMultiplier: number;
  /** Volume floor guardrail; set per dataset (volume units differ by asset). */
  minVolume: number;
}

export interface ScoreResult {
  provider: string;
  winRate: number;
  winCount: number;
  closedCount: number;
  maxDrawdown: number;
  backtest: BacktestResult;
}

const DEFAULT_OPTIONS: ScoreOptions = {
  symbol: 'BTC/USDT',
  initialQuote: 10000,
  feeRate: 0,
  fraction: 0.1,
  atrStopMultiplier: 2,
  minVolume: 0,
};

export function computeWinRate(trades: { realizedPnl: number }[]): number {
  const closes = trades.filter((t) => t.realizedPnl !== 0);
  if (closes.length === 0) return 0;
  const wins = closes.filter((t) => t.realizedPnl > 0).length;
  return wins / closes.length;
}

export function computeMaxDrawdown(equity: { equity: number }[]): number {
  let peak = 0;
  let maxDrawdown = 0;
  for (const point of equity) {
    peak = Math.max(peak, point.equity);
    if (peak > 0) {
      maxDrawdown = Math.max(maxDrawdown, (peak - point.equity) / peak);
    }
  }
  return maxDrawdown;
}

export async function scoreProbes(
  dataset: Dataset,
  probes: ProbeResult[],
  partialOptions?: Partial<ScoreOptions>,
): Promise<ScoreResult> {
  const opts = { ...DEFAULT_OPTIONS, ...partialOptions };
  const [base, quote] = opts.symbol.split('/');

  const firstPerTimestamp = new Map<number, ProbeResult>();
  for (const p of probes) {
    if (!firstPerTimestamp.has(p.timestamp)) {
      firstPerTimestamp.set(p.timestamp, p);
    }
  }

  const decisions = [...firstPerTimestamp.values()]
    .map((p) => ({
      timestamp: p.timestamp,
      ...(p.validJson && p.action && p.confidence !== null
        ? { action: p.action, confidence: p.confidence }
        : { action: 'hold' as const, confidence: 0 }),
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  const backtest = await new BacktestEngine({
    dataset,
    decisions,
    symbol: opts.symbol,
    base,
    quote,
    initialQuote: opts.initialQuote,
    feeRate: opts.feeRate,
    sizing: { fraction: opts.fraction },
    atrStopMultiplier: opts.atrStopMultiplier,
    guardrails: { minVolume: opts.minVolume },
    collectEquity: true,
  }).run();

  const winCount = backtest.trades.filter((t) => t.realizedPnl > 0).length;
  const closedCount = backtest.trades.filter((t) => t.realizedPnl !== 0).length;
  const maxDrawdown = computeMaxDrawdown(backtest.equityCurve ?? []);

  return {
    provider: probes[0]?.provider ?? '',
    winRate: computeWinRate(backtest.trades),
    winCount,
    closedCount,
    maxDrawdown,
    backtest,
  };
}
