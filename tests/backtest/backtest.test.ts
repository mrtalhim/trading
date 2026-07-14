import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { JsonlLoader } from '../../packages/datasets/src/index.js';
import {
  BacktestEngine,
  type BacktestConfig,
  type RecordedDecision,
} from '../../apps/backtest/src/engine.js';

const GOLDEN = join(process.cwd(), 'datasets', 'golden', 'btc_15m');

async function scriptedDecisions(): Promise<RecordedDecision[]> {
  const loader = new JsonlLoader(GOLDEN);
  const ts: number[] = [];
  for await (const c of loader.candles()) ts.push(c.timestamp);
  ts.sort((a, b) => a - b);
  return ts.map((timestamp, idx) => {
    let action: RecordedDecision['action'] = 'hold';
    if (idx % 15 === 0) action = 'long';
    else if (idx % 15 === 7) action = 'short';
    const confidence = 0.6 + ((idx * 7) % 30) / 100;
    return { timestamp, action, confidence };
  });
}

function makeConfig(decisions: RecordedDecision[]): BacktestConfig {
  return {
    dataset: new JsonlLoader(GOLDEN),
    decisions,
    symbol: 'BTC/USDT',
    base: 'BTC',
    quote: 'USDT',
    initialQuote: 10000,
    feeRate: 0.001,
    sizing: { fraction: 0.2 },
    atrStopMultiplier: 2,
  };
}

describe('BacktestEngine', () => {
  it('produces identical output across two replay runs (determinism)', async () => {
    const decisions = await scriptedDecisions();
    const r1 = await new BacktestEngine(makeConfig(decisions)).run();
    const r2 = await new BacktestEngine(makeConfig(decisions)).run();

    expect(r1.checksum).toBe(r2.checksum);
    expect(r1.trades).toEqual(r2.trades);
    expect(r1.outcomes).toEqual(r2.outcomes);
    expect(r1.realizedPnl).toBe(r2.realizedPnl);
    expect(r1.finalPortfolioValue).toBe(r2.finalPortfolioValue);
  });

  it('contains no NaN in numeric result fields', async () => {
    const decisions = await scriptedDecisions();
    const r = await new BacktestEngine(makeConfig(decisions)).run();
    expect(Number.isNaN(r.realizedPnl)).toBe(false);
    expect(Number.isNaN(r.finalPortfolioValue)).toBe(false);
    expect(Number.isNaN(r.finalPosition)).toBe(false);
    for (const t of r.trades) {
      expect(Number.isNaN(t.price)).toBe(false);
      expect(Number.isNaN(t.realizedPnl)).toBe(false);
    }
  });

  it('executes trades only when guardrails allow and records violations', async () => {
    const decisions = await scriptedDecisions();
    const r = await new BacktestEngine(makeConfig(decisions)).run();
    expect(r.tradeCount).toBeGreaterThan(0);
    for (const o of r.outcomes) {
      if (o.action === 'hold') expect(o.allowed).toBe(true);
      expect(Array.isArray(o.violated)).toBe(true);
    }
  });
});
