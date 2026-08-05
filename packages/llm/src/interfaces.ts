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

export interface DecisionEngine {
  readonly provider: string;
  decide(ctx: DecisionContext): Promise<Decision>;
}

export async function safeDecide(engine: DecisionEngine, ctx: DecisionContext): Promise<Decision> {
  try {
    return await engine.decide(ctx);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return { action: 'hold', confidence: 0 };
  }
}
