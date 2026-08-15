import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { JsonlLoader } from '../../packages/datasets/src/index.js';
import { loadDecisions } from '../../apps/backtest/src/index.js';
import { sweepConfigs } from '../../apps/benchmark/src/sweep.js';

const GOLDEN = join(process.cwd(), 'datasets', 'golden', 'btc_15m');
const DECISIONS = join(process.cwd(), 'tests', 'replay', 'fixtures', 'btc-decisions.jsonl');

describe('benchmark sweep (experimental risk/regime grid)', () => {
  it('produces one row per grid variant and all numerics are finite', async () => {
    const dataset = new JsonlLoader(GOLDEN);
    const decisions = await loadDecisions(DECISIONS);
    const { rows } = await sweepConfigs(dataset, decisions, {
      symbol: 'BTC/USDT',
      minConfidences: [0.5, 0.7, 0.9],
      fractions: [0.1],
      stopMultipliers: [2],
      tpMultipliers: [3],
    });

    // (no-stops row + 1 stops row) × 3 minConfidences
    expect(rows).toHaveLength(6);
    for (const r of rows) {
      expect(Number.isFinite(r.realizedPnl)).toBe(true);
      expect(Number.isFinite(r.maxDrawdown)).toBe(true);
      expect(Number.isFinite(r.finalPortfolioValue)).toBe(true);
      expect(r.winRate).toBeGreaterThanOrEqual(0);
      expect(r.winRate).toBeLessThanOrEqual(1);
      expect(r.closedTrades).toBeLessThanOrEqual(r.trades);
    }
  });

  it('higher minConfidence monotonically reduces trades, and 0.9 blocks everything on the fixture', async () => {
    const dataset = new JsonlLoader(GOLDEN);
    const decisions = await loadDecisions(DECISIONS);
    const { rows } = await sweepConfigs(dataset, decisions, {
      minConfidences: [0.5, 0.7, 0.9],
      fractions: [0.1],
      stopMultipliers: [2],
      tpMultipliers: [3],
    });

    const noStops = rows.filter((r) => !r.enableStops);
    expect(noStops).toHaveLength(3);
    const tradesByConfidence = noStops.map((r) => r.trades);
    expect(tradesByConfidence[0]).toBeGreaterThan(tradesByConfidence[1]);
    expect(tradesByConfidence[1]).toBeGreaterThan(tradesByConfidence[2]);
    expect(tradesByConfidence[2]).toBe(0);
  });

  it('stops-on variants at minConfidence 0.9 have no entries and therefore no exits', async () => {
    const dataset = new JsonlLoader(GOLDEN);
    const decisions = await loadDecisions(DECISIONS);
    const { rows } = await sweepConfigs(dataset, decisions, {
      minConfidences: [0.5, 0.9],
      fractions: [0.1],
      stopMultipliers: [1, 2, 3],
      tpMultipliers: [2, 3],
    });

    const blocked = rows.filter((r) => r.minConfidence === 0.9);
    expect(blocked.length).toBeGreaterThan(0);
    for (const r of blocked) {
      expect(r.trades).toBe(0);
      expect(r.closedTrades).toBe(0);
    }
  });

  it('is deterministic: two sweeps over the same input produce identical rows', async () => {
    const dataset = new JsonlLoader(GOLDEN);
    const decisions = await loadDecisions(DECISIONS);
    const opts = {
      minConfidences: [0.5, 0.9],
      fractions: [0.1],
      stopMultipliers: [2],
      tpMultipliers: [3],
    };
    const r1 = await sweepConfigs(dataset, decisions, opts);
    const r2 = await sweepConfigs(dataset, decisions, opts);
    expect(r1.rows).toEqual(r2.rows);
  });
});
