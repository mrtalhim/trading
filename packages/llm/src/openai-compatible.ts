import type { DecisionContext } from './interfaces.js';
import { BaseDecisionEngine } from './base-engine.js';

export interface OpenAICompatibleConfig {
  baseURL: string;
  apiKey: string;
  model: string;
  timeoutMs?: number;
  extraHeaders?: Record<string, string>;
  fetchImpl?: typeof fetch;
  maxRetries?: number;
  initialRetryDelayMs?: number;
}

export class OpenAICompatibleEngine extends BaseDecisionEngine {
  private readonly baseURL: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly extraHeaders: Record<string, string>;

  constructor(config: OpenAICompatibleConfig) {
    super({
      provider: `openai-compatible:${config.model}`,
      timeoutMs: config.timeoutMs ?? 10_000,
      fetchImpl: config.fetchImpl,
      maxRetries: config.maxRetries,
      initialRetryDelayMs: config.initialRetryDelayMs,
    });
    this.baseURL = config.baseURL;
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.extraHeaders = config.extraHeaders ?? {};
  }

  protected buildRequest(ctx: DecisionContext): {
    payload: unknown;
    url: string;
    headers: Record<string, string>;
  } {
    return {
      url: `${this.baseURL}/chat/completions`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        ...this.extraHeaders,
      },
      payload: {
        model: this.model,
        messages: [
          { role: 'system', content: ctx.systemPrompt },
          { role: 'user', content: ctx.userPrompt },
        ],
        temperature: 0,
      },
    };
  }

  protected extractContent(body: string): string {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    const choices = parsed.choices as { message: { content: string } }[] | undefined;
    if (choices && choices.length > 0) {
      return choices[0].message.content;
    }
    throw new Error(`unexpected OpenAI response shape: ${body.slice(0, 200)}`);
  }
}
