import { probeStats, type ProbeResult } from './probe.js';
import type { ScoreResult } from './score.js';

export interface LeaderboardRow {
  provider: string;
  validJsonRate: number;
  meanLatencyMs: number;
  consistency: number;
  costUsd: number;
  winRate: number;
  realizedPnl: number;
  maxDrawdown: number;
  tradeCount: number;
}

export interface Leaderboard {
  rows: LeaderboardRow[];
}

export function buildLeaderboard(probes: ProbeResult[], scores: ScoreResult[]): Leaderboard {
  const groups = new Map<string, ProbeResult[]>();
  for (const p of probes) {
    const group = groups.get(p.provider) ?? [];
    group.push(p);
    groups.set(p.provider, group);
  }

  const scoreByProvider = new Map(scores.map((s) => [s.provider, s]));
  const providers = new Set<string>([...groups.keys(), ...scoreByProvider.keys()]);

  const rows: LeaderboardRow[] = [];
  for (const provider of providers) {
    const stats = probeStats(groups.get(provider) ?? []);
    const sc = scoreByProvider.get(provider);
    rows.push({
      provider,
      validJsonRate: stats.validJsonRate,
      meanLatencyMs: stats.meanLatencyMs,
      consistency: stats.consistency,
      costUsd: stats.costUsd,
      winRate: sc?.winRate ?? 0,
      realizedPnl: sc?.backtest.realizedPnl ?? 0,
      maxDrawdown: sc?.maxDrawdown ?? 0,
      tradeCount: sc?.backtest.tradeCount ?? 0,
    });
  }

  rows.sort((a, b) => b.realizedPnl - a.realizedPnl || b.validJsonRate - a.validJsonRate);
  return { rows };
}
