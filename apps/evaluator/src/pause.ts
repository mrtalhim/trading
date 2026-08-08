import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { DriftVerdict } from './drift.js';
import type { PeriodMetrics } from './metrics.js';

export const EVALUATOR_PAUSE_FILE = 'evaluator-pause.json';

export interface EvaluatorPauseFile {
  trippedAt: number;
  expiresAt: number | null;
  reason: string;
  metrics: Record<string, number | string | null>;
  report: string;
}

export function evaluatorPausePath(dir: string): string {
  return join(dir, EVALUATOR_PAUSE_FILE);
}

export function buildPauseReason(verdict: DriftVerdict): string {
  const parts = verdict.results
    .filter((r) => r.breached)
    .map((r) => {
      const actual = r.actual === null ? 'n/a' : r.actual.toFixed(4);
      const expected = r.expected === null ? 'n/a' : r.expected.toFixed(4);
      return `${r.metric} ${actual} vs expected ${expected} (maxDev ${r.maxDeviation})`;
    });
  return `drift past threshold on: ${parts.join('; ')}`;
}

export function metricsForPauseFile(
  metrics: PeriodMetrics,
  verdict: DriftVerdict,
): Record<string, number | string | null> {
  const out: Record<string, number | string | null> = {
    model: metrics.model,
    decisionCount: metrics.decisionCount,
    realizedPnl: metrics.realizedPnl,
    winRate: metrics.winRate,
    guardrailRejectionRate: metrics.guardrailRejectionRate,
    costPerTrade: metrics.costPerTrade,
    calibrationError: metrics.calibrationError,
  };
  for (const r of verdict.results) {
    if (r.breached) out[`drift_${r.metric}`] = r.delta;
  }
  return out;
}

export async function writeEvaluatorPause(dir: string, file: EvaluatorPauseFile): Promise<string> {
  await mkdir(dir, { recursive: true });
  const path = evaluatorPausePath(dir);
  await writeFile(path, JSON.stringify(file, null, 2));
  return path;
}
