import { describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { access } from 'node:fs/promises';
import { runEvaluator } from '../../apps/evaluator/src/index.js';
import { entry, makeConfig, trade, writeLog } from './fixtures.js';

function healthyLog() {
  return [
    entry({ trades: [trade({ realizedPnl: 100 })] }),
    entry({ trades: [trade({ realizedPnl: -50 })] }),
    entry({ trades: [trade({ realizedPnl: 40 })] }),
    entry({ trades: [trade({ realizedPnl: -25 })] }),
    entry({ trades: [trade({ realizedPnl: 60 })] }),
    entry({ trades: [trade({ realizedPnl: 0 })] }),
  ];
}

function degradedLog() {
  return [
    entry({ trades: [trade({ realizedPnl: 100 })] }),
    entry({ trades: [trade({ realizedPnl: -50 })] }),
    entry({ trades: [trade({ realizedPnl: -25 })] }),
    entry({ trades: [trade({ realizedPnl: -60 })] }),
    entry({ trades: [trade({ realizedPnl: -40 })] }),
    entry({ trades: [trade({ realizedPnl: 0 })] }),
  ];
}

function winRateBenchmark() {
  return {
    'test-model': [{ metric: 'winRate', expected: 0.6, maxDeviation: 0.1, direction: 'below' }],
  };
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function runInTemp(log: ReturnType<typeof healthyLog>, configOverrides = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'eval-drift-'));
  const logsDir = join(dir, 'logs');
  const reportDir = join(dir, 'reports');
  const controlRunDir = join(dir, 'run');
  await writeLog(logsDir, log);
  const config = makeConfig({
    logsDir,
    reportDir,
    controlRunDir,
    benchmarks: winRateBenchmark(),
    ...configOverrides,
  });
  const report = await runEvaluator({ config, now: 1_800_000_000_000 });
  return { dir, logsDir, reportDir, controlRunDir, report };
}

describe('evaluator drift detection (TDD M9.5 #2)', () => {
  it('reports no drift when the log matches benchmark expectations', async () => {
    const { dir, report } = await runInTemp(healthyLog());
    try {
      expect(report.drift.breached).toBe(false);
      expect(report.paused).toBe(false);
      expect(report.pauseFile).toBeNull();
      const winRate = report.drift.results.find((r) => r.metric === 'winRate');
      expect(winRate?.delta).toBeCloseTo(0.0, 10);
      expect(winRate?.breached).toBe(false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('reports the correct drift delta and tripped pause for an injected degraded win rate', async () => {
    const { dir, report, controlRunDir } = await runInTemp(degradedLog());
    try {
      const winRate = report.drift.results.find((r) => r.metric === 'winRate');
      expect(winRate?.actual).toBeCloseTo(0.2, 10);
      expect(winRate?.delta).toBeCloseTo(-0.4, 10);
      expect(winRate?.breached).toBe(true);
      expect(report.drift.breached).toBe(true);
      expect(report.drift.breachedMetrics).toEqual(['winRate']);
      expect(report.paused).toBe(true);
      expect(report.pauseFile).toBe(join(controlRunDir, 'evaluator-pause.json'));
      expect(await exists(report.pauseFile)).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
