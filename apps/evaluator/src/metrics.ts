import { costModelForModel } from '@trading/llm';
import { readDecisionLogs, type DecisionLogEntry } from '@trading/storage';
import type { CostModel } from './config.js';
import { readWindowViaDuckDB, type MetricsWindow } from './duckdb.js';

export interface PeriodMetrics {
  model: string | null;
  decisionCount: number;
  intentDecisions: number;
  rejectedCount: number;
  invalidCount: number;
  pausedCount: number;
  guardrailRejectionRate: number | null;
  realizedPnl: number;
  feeTotal: number;
  totalFills: number;
  closedTrades: number;
  wins: number;
  winRate: number | null;
  costUsd: number;
  costPerTrade: number | null;
  calibrationError: number | null;
  pairs: string[];
}

export async function loadWindowEntries(
  source: 'duckdb' | 'js',
  path: string,
  window: MetricsWindow,
): Promise<DecisionLogEntry[]> {
  if (source === 'duckdb') {
    return readWindowViaDuckDB(path, window);
  }
  const { entries } = await readDecisionLogs(path);
  return entries.filter(
    (e) => e.candleTimestamp >= window.since && e.candleTimestamp < window.until,
  );
}

export function computeMetrics(
  entries: DecisionLogEntry[],
  costModels: Record<string, CostModel>,
): PeriodMetrics {
  const intent: DecisionLogEntry[] = [];
  let invalidCount = 0;
  let pausedCount = 0;
  let rejectedCount = 0;
  let realizedPnl = 0;
  let feeTotal = 0;
  let totalFills = 0;
  let closedTrades = 0;
  let wins = 0;
  let costUsd = 0;
  const calibration: { confidence: number; outcome: number }[] = [];
  const modelCounts = new Map<string, number>();
  const pairs = new Set<string>();

  for (const e of entries) {
    pairs.add(e.pair);

    if (e.usage && e.model) {
      const rates = costModels[e.model] ?? costModelForModel(e.model);
      if (rates) {
        costUsd +=
          (e.usage.promptTokens * rates.promptPerMillionUsd +
            e.usage.completionTokens * rates.completionPerMillionUsd) /
          1_000_000;
      }
    }

    if (e.invalidDecision) {
      invalidCount += 1;
      continue;
    }
    if (e.pausedBy) {
      pausedCount += 1;
      continue;
    }
    intent.push(e);
    if (!e.allowed) rejectedCount += 1;

    if (e.trades.length > 0) {
      for (const t of e.trades) {
        realizedPnl += t.realizedPnl;
        feeTotal += t.fee;
        if (t.realizedPnl !== 0) {
          closedTrades += 1;
          if (t.realizedPnl > 0) wins += 1;
        }
      }
    } else {
      realizedPnl += e.realizedPnl;
      feeTotal += e.fee;
    }
    totalFills += e.trades.length;

    const net = e.trades.reduce((sum, t) => sum + t.realizedPnl, 0);
    if (net !== 0) {
      calibration.push({ confidence: e.confidence, outcome: net > 0 ? 1 : 0 });
    }

    if (e.model) modelCounts.set(e.model, (modelCounts.get(e.model) ?? 0) + 1);
  }

  let model: string | null = null;
  let max = 0;
  for (const [name, count] of modelCounts) {
    if (count > max) {
      max = count;
      model = name;
    }
  }

  return {
    model,
    decisionCount: entries.length,
    intentDecisions: intent.length,
    rejectedCount,
    invalidCount,
    pausedCount,
    guardrailRejectionRate: intent.length > 0 ? rejectedCount / intent.length : null,
    realizedPnl,
    feeTotal,
    totalFills,
    closedTrades,
    wins,
    winRate: closedTrades > 0 ? wins / closedTrades : null,
    costUsd,
    costPerTrade: totalFills > 0 ? costUsd / totalFills : null,
    calibrationError:
      calibration.length > 0
        ? calibration.reduce((sum, c) => sum + Math.abs(c.confidence - c.outcome), 0) /
          calibration.length
        : null,
    pairs: [...pairs].sort(),
  };
}
