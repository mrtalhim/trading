import type { ReviewContext, ReviewEngine } from '@trading/llm';
import { createReviewEngine } from '@trading/llm';
import { decisionLogPath } from '@trading/storage';
import { PERIOD_MS, type EvaluatorConfig } from './config.js';
import { evaluateDrift } from './drift.js';
import { computeMetrics, loadWindowEntries, type PeriodMetrics } from './metrics.js';
import { buildPauseReason, metricsForPauseFile, writeEvaluatorPause } from './pause.js';
import { writeReport, type EvaluatorReport } from './report.js';

export interface RunEvaluatorOptions {
  config: EvaluatorConfig;
  since?: number;
  until?: number;
  now?: number;
  model?: string;
  reviewEngine?: ReviewEngine | null;
}

function numericMetrics(metrics: PeriodMetrics): Record<string, number | null> {
  const numeric = { ...metrics } as Record<string, unknown>;
  delete numeric.model;
  delete numeric.pairs;
  return numeric as Record<string, number | null>;
}

export async function runEvaluator(opts: RunEvaluatorOptions): Promise<EvaluatorReport> {
  const { config } = opts;
  const now = opts.now ?? Date.now();
  const until = opts.until ?? now;
  const since = opts.since ?? until - PERIOD_MS[config.period];

  const entries = await loadWindowEntries(config.metricsSource, decisionLogPath(config.logsDir), {
    since,
    until,
  });
  const metrics = computeMetrics(entries, config.costModels);

  const expectations =
    config.benchmarks[metrics.model ?? ''] ?? config.benchmarks[opts.model ?? ''] ?? [];
  const drift = evaluateDrift(metrics, expectations, config.minDecisions);

  const reportBase: Omit<EvaluatorReport, 'generatedAt' | 'pauseFile' | 'review'> = {
    period: { since, until, label: config.period },
    model: metrics.model,
    metrics,
    drift,
    paused: drift.breached,
  };

  let reviewEngine = opts.reviewEngine;
  if (reviewEngine === undefined && config.llm) {
    reviewEngine = createReviewEngine({
      baseURL: config.llm.baseURL,
      apiKey: config.llm.apiKey ?? '',
      model: config.llm.model,
      timeoutMs: config.llm.timeoutMs,
    });
  }

  let review: EvaluatorReport['review'] = null;
  if (reviewEngine) {
    const ctx: ReviewContext = {
      model: metrics.model,
      periodStart: since,
      periodEnd: until,
      metrics: numericMetrics(metrics),
      drift: drift.results.map((r) => ({
        metric: r.metric,
        expected: r.expected,
        actual: r.actual,
        maxDeviation: r.maxDeviation,
        direction: r.direction,
        breached: r.breached,
      })),
      breached: drift.breached,
    };
    const result = await reviewEngine.review(ctx);
    review = { model: reviewEngine.model, summary: result.summary };
  }

  const { reportPath } = await writeReport(config.reportDir, {
    generatedAt: now,
    ...reportBase,
    pauseFile: null,
    review,
  });

  let pauseFile: string | null = null;
  if (drift.breached) {
    pauseFile = await writeEvaluatorPause(config.controlRunDir, {
      trippedAt: now,
      expiresAt: now + config.maxPauseMs,
      reason: buildPauseReason(drift),
      metrics: metricsForPauseFile(metrics, drift),
      report: reportPath,
    });
  }

  return {
    generatedAt: now,
    ...reportBase,
    pauseFile,
    review,
  };
}
