import type { DecisionContext } from './interfaces.js';
import { BaseDecisionEngine } from './base-engine.js';

export interface GeminiConfig {
  apiKey: string;
  model: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  maxRetries?: number;
  initialRetryDelayMs?: number;
}

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export class GeminiEngine extends BaseDecisionEngine {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(config: GeminiConfig) {
    super({
      provider: `gemini:${config.model}`,
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
      url: `${API_BASE}/models/${this.model}:generateContent?key=${encodeURIComponent(this.apiKey)}`,
      headers: { 'Content-Type': 'application/json' },
      payload: {
        systemInstruction: { parts: [{ text: ctx.systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: ctx.userPrompt }] }],
        generationConfig: { temperature: 0 },
      },
    };
  }

  protected extractContent(body: string): string {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    const candidates = parsed.candidates as
      { content?: { parts?: { text?: string }[] } }[] | undefined;
    if (candidates && candidates.length > 0) {
      const parts = candidates[0].content?.parts;
      if (parts && parts.length > 0 && parts[0].text) {
        return parts[0].text;
      }
    }
    throw new Error(`unexpected Gemini response shape: ${body.slice(0, 200)}`);
  }
}
