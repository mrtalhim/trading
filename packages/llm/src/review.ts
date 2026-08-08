import type { CostModel } from './interfaces.js';
import { chatCompletion, type ChatCompletionResult } from './chat.js';

export type DriftDirection = 'below' | 'above' | 'either';

export interface ReviewDriftEntry {
  metric: string;
  expected: number | null;
  actual: number | null;
  maxDeviation: number;
  direction: DriftDirection;
  breached: boolean;
}

/**
 * Aggregated facts about a review period. Plain data only — the evaluator maps
 * its own metrics onto this, so packages/llm never depends on the evaluator.
 */
export interface ReviewContext {
  model: string | null;
  periodStart: number;
  periodEnd: number;
  metrics: Record<string, number | null>;
  drift: ReviewDriftEntry[];
  breached: boolean;
}

export interface ReviewResult {
  summary: string;
}

export interface ReviewEngine {
  readonly provider: string;
  readonly model: string;
  review(ctx: ReviewContext): Promise<ReviewResult>;
}

export interface ReviewEngineConfig {
  baseURL: string;
  apiKey: string;
  model: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  maxRetries?: number;
  costModel?: CostModel;
}

const SYSTEM_PROMPT =
  'You are the drift-review component of an automated paper-trading system. ' +
  'You receive a numeric performance summary plus drift deltas compared against ' +
  'backtest expectations. Write a concise, plain-language review (no JSON) covering: ' +
  'what the numbers say, whether the drift is credible given sample size, and what a ' +
  'human should investigate. Do not recommend position sizes, stop-losses, or take-profits.';

export function buildReviewUserPrompt(ctx: ReviewContext): string {
  return JSON.stringify(
    {
      model: ctx.model,
      periodStart: ctx.periodStart,
      periodEnd: ctx.periodEnd,
      metrics: ctx.metrics,
      drift: ctx.drift,
      breached: ctx.breached,
    },
    null,
    2,
  );
}

export class OpenAICompatibleReviewEngine implements ReviewEngine {
  readonly provider: string;
  readonly model: string;

  constructor(private readonly config: ReviewEngineConfig) {
    this.provider = `openai-compatible:${config.model}`;
    this.model = config.model;
  }

  async review(ctx: ReviewContext): Promise<ReviewResult> {
    const result: ChatCompletionResult = await chatCompletion({
      baseURL: this.config.baseURL,
      apiKey: this.config.apiKey,
      model: this.config.model,
      timeoutMs: this.config.timeoutMs,
      fetchImpl: this.config.fetchImpl,
      maxRetries: this.config.maxRetries,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildReviewUserPrompt(ctx) },
      ],
    });
    return { summary: result.content };
  }
}

export function createReviewEngine(config: ReviewEngineConfig): ReviewEngine {
  return new OpenAICompatibleReviewEngine(config);
}
