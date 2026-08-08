import type { DriftDirection } from '@trading/llm';
import type { MetricExpectation } from './config.js';
import type { PeriodMetrics } from './metrics.js';

export interface DriftResult {
  metric: string;
  expected: number | null;
  actual: number | null;
  maxDeviation: number;
  direction: DriftDirection;
  delta: number | null;
  breached: boolean;
  insufficient: boolean;
}

export interface DriftVerdict {
  results: DriftResult[];
  breached: boolean;
  breachedMetrics: string[];
}

export function metricValue(metrics: PeriodMetrics, metric: string): number | null {
  switch (metric) {
    case 'winRate':
      return metrics.winRate;
    case 'realizedPnl':
      return metrics.realizedPnl;
    case 'guardrailRejectionRate':
      return metrics.guardrailRejectionRate;
    case 'costPerTrade':
      return metrics.costPerTrade;
    case 'calibrationError':
      return metrics.calibrationError;
    default:
      return null;
  }
}

function isBreached(
  actual: number,
  expected: number,
  maxDeviation: number,
  direction: DriftDirection,
): boolean {
  const delta = actual - expected;
  if (direction === 'below') return delta < -maxDeviation;
  if (direction === 'above') return delta > maxDeviation;
  return Math.abs(delta) > maxDeviation;
}

export function evaluateDrift(
  metrics: PeriodMetrics,
  expectations: MetricExpectation[],
  minDecisions: number,
): DriftVerdict {
  const insufficient = metrics.decisionCount < minDecisions;
  const results: DriftResult[] = expectations.map((exp) => {
    const actual = metricValue(metrics, exp.metric);
    const breached =
      !insufficient && actual !== null
        ? isBreached(actual, exp.expected, exp.maxDeviation, exp.direction)
        : false;
    return {
      metric: exp.metric,
      expected: exp.expected,
      actual,
      maxDeviation: exp.maxDeviation,
      direction: exp.direction,
      delta: actual === null ? null : actual - exp.expected,
      breached,
      insufficient,
    };
  });

  const breachedMetrics = results.filter((r) => r.breached).map((r) => r.metric);
  return { results, breached: breachedMetrics.length > 0, breachedMetrics };
}
