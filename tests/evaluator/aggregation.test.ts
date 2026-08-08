import { describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { computeMetrics, loadWindowEntries } from '../../apps/evaluator/src/index.js';
import { COST_MODELS, entry, trade, writeLog } from './fixtures.js';

function aggregationFixture() {
  return [
    entry({ confidence: 0.9, trades: [trade({ realizedPnl: 100 })] }),
    entry({ confidence: 0.8, trades: [trade({ realizedPnl: -50 })] }),
    entry({ confidence: 0.7, trades: [trade({ realizedPnl: 40 })] }),
    entry({ confidence: 0.5, trades: [trade({ realizedPnl: 0 })] }),
    entry({ confidence: 0.6, trades: [trade({ realizedPnl: 60 })] }),
    entry({ confidence: 0.9, trades: [trade({ realizedPnl: -20 })] }),
    entry({ allowed: false, violated: ['max_position_percent'] }),
    entry({ allowed: false, violated: ['daily_loss_cap'] }),
    entry({ invalidDecision: true, allowed: false, violated: ['invalid_decision'] }),
    entry({ pausedBy: 'evaluator', allowed: true }),
  ];
}

describe('evaluator aggregation (TDD M9.5 #1)', () => {
  it.each(['duckdb', 'js'] as const)(
    'aggregates a fixed log set via %s into the known expected metrics',
    async (source) => {
      const dir = await mkdtemp(join(tmpdir(), 'eval-agg-'));
      try {
        const path = await writeLog(dir, aggregationFixture());
        const entries = await loadWindowEntries(source, path, {
          since: 0,
          until: 1_800_000_000_000,
        });
        const metrics = computeMetrics(entries, COST_MODELS);

        expect(metrics.model).toBe('test-model');
        expect(metrics.decisionCount).toBe(10);
        expect(metrics.invalidCount).toBe(1);
        expect(metrics.pausedCount).toBe(1);
        expect(metrics.intentDecisions).toBe(8);
        expect(metrics.rejectedCount).toBe(2);
        expect(metrics.guardrailRejectionRate).toBeCloseTo(0.25, 10);
        expect(metrics.realizedPnl).toBeCloseTo(130, 10);
        expect(metrics.feeTotal).toBeCloseTo(60, 10);
        expect(metrics.totalFills).toBe(6);
        expect(metrics.closedTrades).toBe(5);
        expect(metrics.wins).toBe(3);
        expect(metrics.winRate).toBeCloseTo(0.6, 10);
        expect(metrics.costUsd).toBeCloseTo(0.02, 10);
        expect(metrics.costPerTrade).toBeCloseTo(0.02 / 6, 10);
        expect(metrics.calibrationError).toBeCloseTo(0.5, 10);
        expect(metrics.pairs).toEqual(['BTC/IDR']);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  );

  it('duckdb and js sources produce identical metrics (parity)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'eval-parity-'));
    try {
      const path = await writeLog(dir, aggregationFixture());
      const window = { since: 0, until: 1_800_000_000_000 };
      const viaDuckDb = computeMetrics(
        await loadWindowEntries('duckdb', path, window),
        COST_MODELS,
      );
      const viaJs = computeMetrics(await loadWindowEntries('js', path, window), COST_MODELS);
      expect(viaDuckDb).toEqual(viaJs);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('respects the evaluation window', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'eval-window-'));
    try {
      await writeLog(dir, [
        entry({ candleTimestamp: 1_000_000, ts: 1_000_000 }),
        entry({ candleTimestamp: 2_000_000, ts: 2_000_000 }),
        entry({ candleTimestamp: 3_000_000, ts: 3_000_000 }),
      ]);
      const path = join(dir, 'decisions.jsonl');
      const entries = await loadWindowEntries('duckdb', path, {
        since: 2_000_000,
        until: 3_000_000,
      });
      expect(entries.map((e) => e.candleTimestamp)).toEqual([2_000_000]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
