import type { Decision } from '@trading/core';

export interface DecisionContext {
  systemPrompt: string;
  userPrompt: string;
  timestamp?: number;
}

export class DecisionError extends Error {
  readonly provider: string;
  readonly reason: string;

  constructor(provider: string, reason: string, cause?: Error) {
    super(`[${provider}] ${reason}`);
    this.name = 'DecisionError';
    this.provider = provider;
    this.reason = reason;
    if (cause) this.cause = cause;
  }
}

export class DecisionTimeoutError extends DecisionError {
  constructor(provider: string, timeoutMs: number) {
    super(provider, `timeout after ${timeoutMs}ms`);
    this.name = 'DecisionTimeoutError';
  }
}

export class DecisionParseError extends DecisionError {
  readonly raw: string;
  readonly errors: string[];

  constructor(provider: string, raw: string, errors: string[]) {
    super(provider, `parse failed: ${errors.join('; ')}`);
    this.name = 'DecisionParseError';
    this.raw = raw;
    this.errors = errors;
  }
}

export interface Usage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface CostModel {
  promptPerMillionUsd: number;
  completionPerMillionUsd: number;
}

export const ZERO_COST_MODEL: CostModel = { promptPerMillionUsd: 0, completionPerMillionUsd: 0 };

export interface DecisionWithUsage {
  decision: Decision;
  usage: Usage | null;
}

export interface DecisionEngine {
  readonly provider: string;
  readonly costModel?: CostModel;
  decide(ctx: DecisionContext): Promise<Decision>;
  decideWithUsage?(ctx: DecisionContext): Promise<DecisionWithUsage>;
}

export async function safeDecide(engine: DecisionEngine, ctx: DecisionContext): Promise<Decision> {
  try {
    return await engine.decide(ctx);
  } catch (err) {
    console.error(
      err instanceof Error ? `[${classifyLlmError(err)}] ${err.message}` : `[fatal] ${String(err)}`,
    );
    return { action: 'hold', confidence: 0 };
  }
}

export type LlmErrorKind =
  'timeout' | 'rate_limited' | 'malformed_json' | 'http_error' | 'network_error' | 'fatal';

const NETWORK_PATTERN =
  /request failed|fetch failed|ECONNRESET|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|socket hang up/i;

/**
 * Maps any thrown error to a stable, inspectable failure class so callers can
 * distinguish "back off and retry" from "this model/prompt is actually broken".
 *
 * Matches on both `instanceof` and `name`, because apps consume the built
 * `dist` copy of these classes while tests may throw instances of the matching
 * `src` copy — `instanceof` alone is unreliable across the two module copies,
 * but the constructor-set `name` is identical in both.
 *
 * Order matters: DecisionTimeoutError/DecisionParseError subclass DecisionError,
 * so the specific classes are tested first.
 */
export function classifyLlmError(err: unknown): LlmErrorKind {
  if (
    err instanceof DecisionTimeoutError ||
    (err instanceof Error && err.name === 'DecisionTimeoutError')
  )
    return 'timeout';
  if (
    err instanceof DecisionParseError ||
    (err instanceof Error && err.name === 'DecisionParseError')
  )
    return 'malformed_json';
  if (err instanceof DecisionError || (err instanceof Error && err.name === 'DecisionError')) {
    const reason =
      err instanceof DecisionError ? err.reason : err instanceof Error ? err.message : '';
    if (reason.includes('HTTP 429')) return 'rate_limited';
    if (reason.match(/HTTP \d{3}/)) return 'http_error';
    if (reason.includes('timeout after')) return 'timeout';
    if (NETWORK_PATTERN.test(reason)) return 'network_error';
    return 'fatal';
  }
  if (err instanceof Error) {
    if (err.name === 'AbortError' || /abort/i.test(err.message)) return 'timeout';
    if (NETWORK_PATTERN.test(err.message)) return 'network_error';
  }
  return 'fatal';
}
