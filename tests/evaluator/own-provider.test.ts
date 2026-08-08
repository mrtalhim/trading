import { describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ReviewContext, ReviewEngine } from '../../packages/llm/src/index.js';
import { runEvaluator } from '../../apps/evaluator/src/index.js';
import { entry, makeConfig, trade, writeLog } from './fixtures.js';

function logForModel(model: string) {
  return [
    entry({ model, trades: [trade({ realizedPnl: 100 })] }),
    entry({ model, trades: [trade({ realizedPnl: -50 })] }),
  ];
}

function capturingEngine(model: string): ReviewEngine & { calls: ReviewContext[] } {
  const calls: ReviewContext[] = [];
  return {
    provider: `fake:${model}`,
    model,
    calls,
    async review(ctx: ReviewContext) {
      calls.push(ctx);
      return { summary: `reviewed with ${model}` };
    },
  };
}

describe('evaluator uses its own provider/model (TDD M9.5 #6)', () => {
  it('uses the evaluator-config review model, independent of the runner model in the logs', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'eval-provider-'));
    try {
      const logsDir = join(dir, 'logs');
      const reportDir = join(dir, 'reports');
      await writeLog(logsDir, logForModel('runner-model-a'));

      const config = makeConfig({
        logsDir,
        reportDir,
        controlRunDir: join(dir, 'run'),
        llm: { baseURL: 'http://unused.example.test', model: 'review-model' },
      });
      const engine = capturingEngine('review-model');
      const report = await runEvaluator({
        config,
        now: 1_800_000_000_000,
        reviewEngine: engine,
      });

      expect(report.review).not.toBeNull();
      expect(report.review!.model).toBe('review-model');
      expect(engine.calls).toHaveLength(1);
      expect(engine.calls[0].model).toBe('runner-model-a');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('changing the runner model in the logs does not change the evaluator review provider', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'eval-provider2-'));
    try {
      const run = async (runnerModel: string) => {
        const logsDir = join(dir, `logs-${runnerModel}`);
        const reportDir = join(dir, `reports-${runnerModel}`);
        await writeLog(logsDir, logForModel(runnerModel));
        const config = makeConfig({
          logsDir,
          reportDir,
          controlRunDir: join(dir, `run-${runnerModel}`),
          llm: { baseURL: 'http://unused.example.test', model: 'review-model' },
        });
        const engine = capturingEngine('review-model');
        const report = await runEvaluator({
          config,
          now: 1_800_000_000_000,
          reviewEngine: engine,
        });
        return { report, engine };
      };

      const a = await run('runner-model-a');
      const b = await run('runner-model-b');
      expect(a.report.review!.model).toBe('review-model');
      expect(b.report.review!.model).toBe('review-model');
      expect(a.engine.calls[0].model).toBe('runner-model-a');
      expect(b.engine.calls[0].model).toBe('runner-model-b');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('produces no review when the evaluator has no review provider configured', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'eval-noreview-'));
    try {
      const logsDir = join(dir, 'logs');
      const reportDir = join(dir, 'reports');
      await writeLog(logsDir, logForModel('runner-model-a'));
      const config = makeConfig({
        logsDir,
        reportDir,
        controlRunDir: join(dir, 'run'),
        llm: null,
      });
      const report = await runEvaluator({ config, now: 1_800_000_000_000 });
      expect(report.review).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
