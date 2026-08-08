import type { Usage } from './interfaces.js';
import { DecisionError, DecisionTimeoutError } from './interfaces.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionRequest {
  baseURL: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  maxRetries?: number;
  initialRetryDelayMs?: number;
}

export interface ChatCompletionResult {
  content: string;
  usage: Usage | null;
}

/**
 * Minimal OpenAI-compatible chat completion call with retry-on-transient and a
 * hard timeout. Freeform (non-JSON) responses are supported — unlike the
 * decision path, the content is returned verbatim.
 */
export async function chatCompletion(req: ChatCompletionRequest): Promise<ChatCompletionResult> {
  const provider = `openai-compatible:${req.model}`;
  const timeoutMs = req.timeoutMs ?? 10_000;
  const fetchImpl = req.fetchImpl ?? globalThis.fetch;
  const maxRetries = req.maxRetries ?? 3;
  const initialRetryDelayMs = req.initialRetryDelayMs ?? 1000;

  let lastError: DecisionError | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await attemptCall();
    } catch (err) {
      if (!(err instanceof DecisionError)) throw err;
      const isRetryable = err.reason.includes('HTTP 429') || err.reason.includes('HTTP 5');
      if (!isRetryable || attempt >= maxRetries) throw err;
      lastError = err;
      const retryAfter = err.reason.match(/retry-after["\s:]+(\d+)/i);
      const delay = retryAfter ? Number(retryAfter[1]) * 1000 : initialRetryDelayMs * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError!;

  async function attemptCall(): Promise<ChatCompletionResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(`${req.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${req.apiKey}`,
        },
        body: JSON.stringify({
          model: req.model,
          messages: req.messages,
          temperature: 0,
        }),
        signal: controller.signal,
      });

      const body = await response.text();

      if (!response.ok) {
        throw new DecisionError(provider, `HTTP ${response.status}: ${body.slice(0, 200)}`);
      }

      const parsed = JSON.parse(body) as {
        choices?: { message: { content: string } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      };

      const content = parsed.choices?.[0]?.message?.content;
      if (typeof content !== 'string') {
        throw new DecisionError(provider, `unexpected response shape: ${body.slice(0, 200)}`);
      }

      const u = parsed.usage;
      const usage: Usage | null =
        u && typeof u.prompt_tokens === 'number' && typeof u.completion_tokens === 'number'
          ? {
              promptTokens: u.prompt_tokens,
              completionTokens: u.completion_tokens,
              totalTokens: u.total_tokens ?? u.prompt_tokens + u.completion_tokens,
            }
          : null;

      return { content, usage };
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new DecisionTimeoutError(provider, timeoutMs);
      }
      if (err instanceof DecisionError) throw err;
      throw new DecisionError(provider, 'request failed', err instanceof Error ? err : undefined);
    } finally {
      clearTimeout(timer);
    }
  }
}
