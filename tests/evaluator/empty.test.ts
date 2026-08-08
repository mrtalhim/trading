import { describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readdir } from 'node:fs/promises';
import { runEvaluator } from '../../apps/evaluator/src/index.js';
import { entry, makeConfig, writeLog } from './fixtures.js';

describe('evaluator on empty / partial log sets (TDD M9.5 #5)', () => {
  it('handles an empty decisions.jsonl without crashing and reports no drift', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'eval-empty-'));
    try {
      const logsDir = join(dir, 'logs');
      const reportDir = join(dir, 'reports');
      const controlRunDir = join(dir, 'run');
      await mkdir(logsDir, { recursive: true });
      await writeFile(join(logsDir, 'decisions.jsonl'), '');

      const config = makeConfig({
        logsDir,
        reportDir,
        controlRunDir,
        minDecisions: 1,
        benchmarks: {
          'test-model': [
            { metric: 'winRate', expected: 0.6, maxDeviation: 0.1, direction: 'below' },
          ],
        },
      });
      const report = await runEvaluator({ config, now: 1_800_000_000_000 });

      expect(report.metrics.decisionCount).toBe(0);
      expect(report.metrics.winRate).toBeNull();
      expect(report.metrics.guardrailRejectionRate).toBeNull();
      expect(report.metrics.costPerTrade).toBeNull();
      expect(report.metrics.model).toBeNull();
      expect(report.drift.breached).toBe(false);
      expect(report.pauseFile).toBeNull();
      expect((await readdir(reportDir)).length).toBe(2);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('handles a missing decisions.jsonl (first day of a new deployment) without crashing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'eval-nofile-'));
    try {
      const logsDir = join(dir, 'logs');
      const reportDir = join(dir, 'reports');
      const controlRunDir = join(dir, 'run');
      await mkdir(logsDir, { recursive: true });

      const config = makeConfig({ logsDir, reportDir, controlRunDir, minDecisions: 1 });
      const report = await runEvaluator({ config, now: 1_800_000_000_000 });

      expect(report.metrics.decisionCount).toBe(0);
      expect(report.drift.breached).toBe(false);
      expect(report.pauseFile).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('handles a partial log (one decision, no trades) with null win rate and no drift', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'eval-partial-'));
    try {
      const logsDir = join(dir, 'logs');
      const reportDir = join(dir, 'reports');
      const controlRunDir = join(dir, 'run');
      await writeLog(logsDir, [entry({ trades: [] })]);

      const config = makeConfig({
        logsDir,
        reportDir,
        controlRunDir,
        minDecisions: 1,
        benchmarks: {
          'test-model': [
            { metric: 'winRate', expected: 0.6, maxDeviation: 0.1, direction: 'below' },
          ],
        },
      });
      const report = await runEvaluator({ config, now: 1_800_000_000_000 });

      expect(report.metrics.decisionCount).toBe(1);
      expect(report.metrics.winRate).toBeNull();
      expect(report.metrics.closedTrades).toBe(0);
      expect(report.drift.breached).toBe(false);
      expect(report.pauseFile).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
