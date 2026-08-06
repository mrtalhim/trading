import { describe, expect, it } from 'vitest';
import {
  buildLeaderboard,
  type ProbeResult,
  type ScoreResult,
} from '../../apps/benchmark/src/index.js';
import { makeCandles } from './helpers.js';

function probe(
  provider: string,
  timestamp: number,
  valid: boolean,
  action: 'long' | 'hold' | 'short',
  costUsd = 0,
): ProbeResult {
  return {
    timestamp,
    provider,
    preset: provider,
    validJson: valid,
    action: valid ? action : null,
    confidence: valid ? 0.7 : null,
    latencyMs: 100,
    costUsd,
  };
}

function score(
  provider: string,
  realizedPnl: number,
  winRate = 0.5,
  maxDrawdown = 0.1,
  tradeCount = 10,
): ScoreResult {
  return {
    provider,
    winRate,
    maxDrawdown,
    backtest: {
      symbol: 'BTC/USDT',
      start: 0,
      end: 1,
      candleCount: 2,
      initialQuote: 10000,
      finalQuoteFree: 0,
      finalPosition: 0,
      finalPortfolioValue: 10000 + realizedPnl,
      realizedPnl,
      totalFees: 0,
      tradeCount,
      guardrailViolations: {},
      trades: [],
      outcomes: [],
      checksum: 'abcd',
      equityCurve: [{ timestamp: 0, equity: 100 }],
    } as unknown as ScoreResult['backtest'],
  };
}

describe('buildLeaderboard', () => {
  it('merges probe stats and score per provider into comparable rows', () => {
    const candles = makeCandles(6);
    const ts = candles.map((c) => c.timestamp).slice(0, 4);
    const probes: ProbeResult[] = [
      ...ts.map((t, i) => probe('gemini', t, i !== 1, 'long')),
      ...ts.map((t) => probe('gemma', t, true, 'hold')),
    ];
    const scores: ScoreResult[] = [
      score('gemini', 500, 0.6, 0.2, 5),
      score('gemma', 300, 0.4, 0.05, 8),
    ];

    const lb = buildLeaderboard(probes, scores);
    expect(lb.rows).toHaveLength(2);

    const gemini = lb.rows.find((r) => r.provider === 'gemini')!;
    expect(gemini.validJsonRate).toBeCloseTo(3 / 4, 6);
    expect(gemini.meanLatencyMs).toBe(100);
    expect(gemini.consistency).toBeCloseTo(3 / 4, 6);
    expect(gemini.costUsd).toBe(0);
    expect(gemini.winRate).toBe(0.6);
    expect(gemini.realizedPnl).toBe(500);
    expect(gemini.maxDrawdown).toBe(0.2);
    expect(gemini.tradeCount).toBe(5);

    const gemma = lb.rows.find((r) => r.provider === 'gemma')!;
    expect(gemma.validJsonRate).toBe(1);
    expect(gemma.realizedPnl).toBe(300);
  });

  it('sorts by realizedPnl desc, tie-breaking by validJsonRate desc', () => {
    const probes = [
      probe('a', 1, true, 'hold'),
      probe('a', 2, true, 'hold'),
      probe('b', 1, true, 'hold'),
      probe('b', 2, false, 'hold'),
      probe('c', 1, false, 'hold'),
    ];
    const scores = [score('b', 100), score('a', 100), score('c', 50)];
    const lb = buildLeaderboard(probes, scores);
    expect(lb.rows.map((r) => r.provider)).toEqual(['a', 'b', 'c']);
    expect(lb.rows[0].validJsonRate).toBe(1);
    expect(lb.rows[1].validJsonRate).toBe(0.5);
  });

  it('keeps providers with zero valid decisions without crashing', () => {
    const probes = [probe('all-invalid', 1, false, 'hold'), probe('all-invalid', 2, false, 'hold')];
    const scores = [score('all-invalid', 0, 0, 0, 0)];
    const lb = buildLeaderboard(probes, scores);
    const row = lb.rows.find((r) => r.provider === 'all-invalid')!;
    expect(row.validJsonRate).toBe(0);
    expect(row.consistency).toBe(0);
    expect(row.winRate).toBe(0);
  });

  it('produces byte-identical JSON for identical inputs', () => {
    const probes = [probe('gemini', 1, true, 'long'), probe('gemma', 1, true, 'hold')];
    const scores = [score('gemini', 100), score('gemma', 50)];
    const a = JSON.stringify(buildLeaderboard(probes, scores));
    const b = JSON.stringify(buildLeaderboard(probes, scores));
    expect(a).toBe(b);
  });
});
