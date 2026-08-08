import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { DriftVerdict } from './drift.js';
import type { PeriodMetrics } from './metrics.js';

export interface EvaluatorReport {
  generatedAt: number;
  period: { since: number; until: number; label: string };
  model: string | null;
  metrics: PeriodMetrics;
  drift: DriftVerdict;
  paused: boolean;
  pauseFile: string | null;
  review: { model: string; summary: string } | null;
}

export function reportFileName(until: number): string {
  return `evaluator-report-${until}.json`;
}

export function writeMarkdownReport(report: EvaluatorReport): string {
  const lines: string[] = [
    `# Evaluator report — ${report.period.label}`,
    '',
    `period: ${report.period.since} .. ${report.period.until}`,
    `model: ${report.model ?? 'unknown'}`,
    `paused: ${report.paused}`,
    '',
    '## Metrics',
    '',
    '| metric | value |',
    '| --- | --- |',
    `| decisions | ${report.metrics.decisionCount} |`,
    `| intent decisions | ${report.metrics.intentDecisions} |`,
    `| rejected | ${report.metrics.rejectedCount} |`,
    `| invalid | ${report.metrics.invalidCount} |`,
    `| paused | ${report.metrics.pausedCount} |`,
    `| guardrail rejection rate | ${fmt(report.metrics.guardrailRejectionRate)} |`,
    `| realized pnl | ${fmt(report.metrics.realizedPnl)} |`,
    `| win rate | ${fmt(report.metrics.winRate)} |`,
    `| cost usd | ${fmt(report.metrics.costUsd)} |`,
    `| cost per trade | ${fmt(report.metrics.costPerTrade)} |`,
    `| calibration error | ${fmt(report.metrics.calibrationError)} |`,
    `| pairs | ${report.metrics.pairs.join(', ') || 'none'} |`,
    '',
    '## Drift',
    '',
    '| metric | actual | expected | maxDev | direction | breached |',
    '| --- | --- | --- | --- | --- | --- |',
  ];
  for (const r of report.drift.results) {
    lines.push(
      `| ${r.metric} | ${fmt(r.actual)} | ${fmt(r.expected)} | ${r.maxDeviation} | ${r.direction} | ${r.breached} |`,
    );
  }
  if (report.review) {
    lines.push('', '## LLM review', '', report.review.summary, '');
  }
  return lines.join('\n');
}

function fmt(v: number | null): string {
  return v === null ? 'n/a' : String(v);
}

export async function writeReport(
  dir: string,
  report: EvaluatorReport,
): Promise<{ reportPath: string; markdownPath: string }> {
  await mkdir(dir, { recursive: true });
  const reportPath = join(dir, reportFileName(report.period.until));
  const markdownPath = join(dir, `evaluator-report-${report.period.until}.md`);
  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  await writeFile(markdownPath, writeMarkdownReport(report));
  return { reportPath, markdownPath };
}
