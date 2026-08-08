import { describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { access } from 'node:fs/promises';
import { runEvaluator } from '../../apps/evaluator/src/index.js';
import { entry, makeConfig, trade, writeLog } from './fixtures.js';

function entriesWithWinRate(wins: number, losses: number) {
  const entries = [];
  for (let i = 0; i < wins; i++) entries.push(entry({ trades: [trade({ realizedPnl: 100 })] }));
  for (let i = 0; i < losses; i++) entries.push(entry({ trades: [trade({ realizedPnl: -50 })] }));
  return entries;
}

function benchmarks() {
  return {
    'test-model': [{ metric: 'winRate', expected: 0.6, maxDeviation: 0.1, direction: 'below' }],
  };
}

async function runWith(log: ReturnType<typeof entriesWithWinRate>, minDecisions = 1) {
  const dir = await mkdtemp(join(tmpdir(), 'eval-thresh-'));
  const logsDir = join(dir, 'logs');
  const reportDir = join(dir, 'reports');
  const controlRunDir = join(dir, 'run');
  await writeLog(logsDir, log);
  const config = makeConfig({
    logsDir,
    reportDir,
    controlRunDir,
    minDecisions,
    benchmarks: benchmarks(),
  });
  const report = await runEvaluator({ config, now: 1_800_000_000_000 });
  return { dir, controlRunDir, report };
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

describe('evaluator pause-and-alert threshold (TDD M9.5 #3)', () => {
  it('does not fire on a small ordinary fluctuation (false-positive case)', async () => {
    const { dir, report, controlRunDir } = await runWith(entriesWithWinRate(11, 9));
    try {
      expect(report.drift.breached).toBe(false);
      expect(report.paused).toBe(false);
      expect(report.pauseFile).toBeNull();
      expect(await exists(join(controlRunDir, 'evaluator-pause.json'))).toBe(false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('does not fire exactly at the threshold boundary', async () => {
    const { dir, report } = await runWith(entriesWithWinRate(10, 10));
    try {
      expect(report.drift.breached).toBe(false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('fires and writes a persistent pause file when win rate is deliberately degraded (true-positive case)', async () => {
    const { dir, report, controlRunDir } = await runWith(entriesWithWinRate(8, 12));
    try {
      expect(report.drift.breached).toBe(true);
      expect(report.drift.breachedMetrics).toEqual(['winRate']);
      expect(report.paused).toBe(true);
      expect(report.pauseFile).toBe(join(controlRunDir, 'evaluator-pause.json'));
      expect(await exists(report.pauseFile!)).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('does not trip on a large deviation when the sample is too small (short-term noise gate)', async () => {
    const { dir, report } = await runWith(entriesWithWinRate(1, 4), 1000);
    try {
      const winRate = report.drift.results.find((r) => r.metric === 'winRate');
      expect(winRate?.insufficient).toBe(true);
      expect(winRate?.breached).toBe(false);
      expect(report.drift.breached).toBe(false);
      expect(report.pauseFile).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
