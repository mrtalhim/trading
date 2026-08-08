import type { Dataset } from '@trading/datasets';
import { BacktestEngine, type RecordedDecision } from '@trading/backtest';
import { computeWinRate, computeMaxDrawdown } from './score.js';

export interface SweepVariant {
  minConfidence: number;
  fraction: number;
  enableStops: boolean;
  atrStopMultiplier: number;
  atrTpMultiplier: number;
}

export interface SweepOptions {
  symbol: string;
  initialQuote: number;
  feeRate: number;
  /** Volume floor applied to every variant (0 = never block on volume). */
  minVolume: number;
  minConfidences: number[];
  fractions: number[];
  stopMultipliers: number[];
  tpMultipliers: number[];
}

export interface SweepRow extends SweepVariant {
  trades: number;
  closedTrades: number;
  winRate: number;
  realizedPnl: number;
  maxDrawdown: number;
  finalPortfolioValue: number;
  guardrailViolations: Record<string, number>;
}

export interface SweepResult {
  rows: SweepRow[];
}

const DEFAULT_OPTIONS: SweepOptions = {
  symbol: 'BTC/USDT',
  initialQuote: 10000,
  feeRate: 0,
  minVolume: 0,
  minConfidences: [0.5, 0.6, 0.7, 0.8, 0.9],
  fractions: [0.05, 0.1, 0.2],
  stopMultipliers: [1, 2, 3],
  tpMultipliers: [2, 3],
};

export async function sweepConfigs(
  dataset: Dataset,
  decisions: RecordedDecision[],
  partialOptions?: Partial<SweepOptions>,
): Promise<SweepResult> {
  const opts = { ...DEFAULT_OPTIONS, ...partialOptions };
  const [base, quote] = opts.symbol.split('/');
  if (!base || !quote) throw new Error(`invalid --symbol (expected BASE/QUOTE): ${opts.symbol}`);

  const rows: SweepRow[] = [];

  async function runVariant(v: SweepVariant): Promise<void> {
    const backtest = await new BacktestEngine({
      dataset,
      decisions,
      symbol: opts.symbol,
      base,
      quote,
      initialQuote: opts.initialQuote,
      feeRate: opts.feeRate,
      sizing: { fraction: v.fraction },
      atrStopMultiplier: v.atrStopMultiplier,
      atrTpMultiplier: v.atrTpMultiplier,
      enableStops: v.enableStops,
      guardrails: { minConfidence: v.minConfidence, minVolume: opts.minVolume },
      collectEquity: true,
    }).run();
    rows.push({
      ...v,
      trades: backtest.tradeCount,
      closedTrades: backtest.trades.filter((t) => t.realizedPnl !== 0).length,
      winRate: computeWinRate(backtest.trades),
      realizedPnl: backtest.realizedPnl,
      maxDrawdown: computeMaxDrawdown(backtest.equityCurve ?? []),
      finalPortfolioValue: backtest.finalPortfolioValue,
      guardrailViolations: backtest.guardrailViolations,
    });
  }

  for (const minConfidence of opts.minConfidences) {
    for (const fraction of opts.fractions) {
      await runVariant({
        minConfidence,
        fraction,
        enableStops: false,
        atrStopMultiplier: 2,
        atrTpMultiplier: 3,
      });
      for (const atrStopMultiplier of opts.stopMultipliers) {
        for (const atrTpMultiplier of opts.tpMultipliers) {
          await runVariant({
            minConfidence,
            fraction,
            enableStops: true,
            atrStopMultiplier,
            atrTpMultiplier,
          });
        }
      }
    }
  }

  return { rows };
}
