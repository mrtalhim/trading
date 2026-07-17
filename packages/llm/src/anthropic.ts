import type { DecisionContext } from './interfaces.js';
import { BaseDecisionEngine } from './base-engine.js';

export interface AnthropicConfig {
  apiKey: string;
  model: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  maxRetries?: number;
  initialRetryDelayMs?: number;
}

export class AnthropicEngine extends BaseDecisionEngine {
  private static readonly API_URL = 'https://api.anthropic.com/v1/messages';
  private static readonly API_VERSION = '2023-06-01';

  private readonly apiKey: string;
  private readonly model: string;

  constructor(config: AnthropicConfig) {
    super({
      provider: `anthropic:${config.model}`,
      timeoutMs: config.timeoutMs ?? 10_000,
      fetchImpl: config.fetchImpl,
      maxRetries: config.maxRetries,
      initialRetryDelayMs: config.initialRetryDelayMs,
    });
    this.apiKey = config.apiKey;
    this.model = config.model;
  }

  protected buildRequest(ctx: DecisionContext): {
    payload: unknown;
    url: string;
    headers: Record<string, string>;
  } {
    return {
      url: AnthropicEngine.API_URL,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': AnthropicEngine.API_VERSION,
      },
      payload: {
        model: this.model,
        system: ctx.systemPrompt,
        messages: [{ role: 'user', content: ctx.userPrompt }],
        max_tokens: 256,
        temperature: 0,
      },
    };
  }

  protected extractContent(body: string): string {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    const content = parsed.content as { type: string; text: string }[] | undefined;
    if (content && content.length > 0) {
      return content[0].text;
    }
    throw new Error(`unexpected Anthropic response shape: ${body.slice(0, 200)}`);
  }
}
