import { parseDecision } from '@trading/core';
import type { Decision } from '@trading/core';
import type { DecisionContext, DecisionWithUsage } from './interfaces.js';
import {
  ZERO_COST_MODEL,
  type CostModel,
  DecisionError,
  DecisionParseError,
  DecisionTimeoutError,
  type Usage,
} from './interfaces.js';

export interface BaseEngineConfig {
  provider: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
  maxRetries?: number;
  initialRetryDelayMs?: number;
  costModel?: CostModel;
}

export abstract class BaseDecisionEngine {
  readonly provider: string;
  readonly costModel: CostModel;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly maxRetries: number;
  private readonly initialRetryDelayMs: number;

  constructor(config: BaseEngineConfig) {
    this.provider = config.provider;
    this.timeoutMs = config.timeoutMs;
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch;
    this.maxRetries = config.maxRetries ?? 3;
    this.initialRetryDelayMs = config.initialRetryDelayMs ?? 1000;
    this.costModel = config.costModel ?? ZERO_COST_MODEL;
  }

  async decide(ctx: DecisionContext): Promise<Decision> {
    return (await this.decideWithUsage(ctx)).decision;
  }

  async decideWithUsage(ctx: DecisionContext): Promise<DecisionWithUsage> {
    let lastError: DecisionError | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.attemptDecide(ctx);
      } catch (err) {
        if (!(err instanceof DecisionError)) throw err;

        const isRetryable = err.reason.includes('HTTP 429') || err.reason.includes('HTTP 5');

        if (!isRetryable || attempt >= this.maxRetries) {
          throw err;
        }

        lastError = err;

        const retryAfter = this.extractRetryAfter(err.reason);
        const delay = retryAfter ? retryAfter * 1000 : this.initialRetryDelayMs * 2 ** attempt;

        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  private async attemptDecide(ctx: DecisionContext): Promise<DecisionWithUsage> {
    const { payload, url, headers } = this.buildRequest(ctx);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const body = await response.text();

      if (!response.ok) {
        throw new DecisionError(this.provider, `HTTP ${response.status}: ${body.slice(0, 200)}`);
      }

      const raw = this.extractContent(body);
      const decision = this.parse(raw);
      return { decision, usage: this.extractUsage(body) };
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new DecisionTimeoutError(this.provider, this.timeoutMs);
      }
      if (
        err instanceof DecisionParseError ||
        err instanceof DecisionTimeoutError ||
        err instanceof DecisionError
      ) {
        throw err;
      }
      throw new DecisionError(
        this.provider,
        'request failed',
        err instanceof Error ? err : undefined,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private extractRetryAfter(reason: string): number | null {
    const match = reason.match(/retry-after["\s:]+(\d+)/i);
    return match ? Number(match[1]) : null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  protected extractUsage(_body: string): Usage | null {
    return null;
  }

  protected abstract buildRequest(ctx: DecisionContext): {
    payload: unknown;
    url: string;
    headers: Record<string, string>;
  };

  protected abstract extractContent(body: string): string;

  private parse(raw: string): Decision {
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();
    let value: unknown;
    try {
      value = JSON.parse(cleaned);
    } catch {
      throw new DecisionParseError(this.provider, raw, ['invalid JSON']);
    }
    const result = parseDecision(value);
    if (!result.success || !result.data) {
      throw new DecisionParseError(this.provider, raw, result.errors);
    }
    return result.data;
  }
}
