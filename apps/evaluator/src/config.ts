import { z } from 'zod';

export const PERIOD_MS: Record<'daily' | 'weekly', number> = {
  daily: 86_400_000,
  weekly: 7 * 86_400_000,
};

export const driftDirectionSchema = z.enum(['below', 'above', 'either']);

export const metricExpectationSchema = z.object({
  metric: z.enum([
    'winRate',
    'realizedPnl',
    'guardrailRejectionRate',
    'costPerTrade',
    'calibrationError',
  ]),
  expected: z.number(),
  maxDeviation: z.number().nonnegative(),
  direction: driftDirectionSchema.default('either'),
});

export const costModelSchema = z.object({
  promptPerMillionUsd: z.number().nonnegative(),
  completionPerMillionUsd: z.number().nonnegative(),
});

export const reviewConfigSchema = z.object({
  baseURL: z.string(),
  apiKey: z.string().optional(),
  model: z.string(),
  timeoutMs: z.number().positive().optional(),
});

export const evaluatorConfigSchema = z.object({
  period: z.enum(['daily', 'weekly']).default('daily'),
  logsDir: z.string(),
  reportDir: z.string(),
  controlRunDir: z.string(),
  maxPauseMs: z.number().positive().default(86_400_000),
  minDecisions: z.number().int().nonnegative().default(30),
  metricsSource: z.enum(['duckdb', 'js']).default('duckdb'),
  costModels: z.record(costModelSchema).default({}),
  benchmarks: z.record(z.array(metricExpectationSchema)).default({}),
  llm: reviewConfigSchema.nullable().default(null),
});

export type EvaluatorConfig = z.infer<typeof evaluatorConfigSchema>;
export type MetricExpectation = z.infer<typeof metricExpectationSchema>;
export type CostModel = { promptPerMillionUsd: number; completionPerMillionUsd: number };

export function parseEvaluatorConfig(raw: unknown): EvaluatorConfig {
  return evaluatorConfigSchema.parse(raw);
}
