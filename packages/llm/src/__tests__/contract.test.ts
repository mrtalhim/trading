import { describe, it, expect } from 'vitest';
import type { DecisionEngine, DecisionContext } from '../interfaces.js';
import { safeDecide, DecisionParseError, DecisionTimeoutError } from '../interfaces.js';
import { OpenAICompatibleEngine } from '../openai-compatible.js';
import { AnthropicEngine } from '../anthropic.js';

const VALID_DECISION = JSON.stringify({ action: 'long', confidence: 0.7 });
const VALID_SHORT = JSON.stringify({ action: 'short', confidence: 0.9 });
const VALID_HOLD = JSON.stringify({ action: 'hold', confidence: 0.5 });

function openAIResponse(content: string, status = 200): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status });
}

function anthropicResponse(text: string, status = 200): Response {
  return new Response(JSON.stringify({ content: [{ type: 'text', text }] }), { status });
}

function neverResolves(_url: string | URL | Request, init?: RequestInit): Promise<Response> {
  return new Promise((_resolve, reject) => {
    if (init?.signal) {
      if (init.signal.aborted) {
        reject(new DOMException('The operation was aborted.', 'AbortError'));
        return;
      }
      init.signal.addEventListener('abort', () => {
        reject(new DOMException('The operation was aborted.', 'AbortError'));
      }, { once: true });
    }
  });
}

const baseCtx: DecisionContext = {
  systemPrompt: 'You are a trading assistant.',
  userPrompt: 'Decide action based on RSI=72, ATR=150.',
};

type AdapterEntry = [string, (fetchImpl: typeof fetch) => DecisionEngine];

const adapters: AdapterEntry[] = [
  [
    'OpenAICompatible',
    (fi) =>
      new OpenAICompatibleEngine({
        baseURL: 'https://example.test/v1',
        apiKey: 'test-key',
        model: 'test/model',
        timeoutMs: 500,
        fetchImpl: fi,
        maxRetries: 0,
      }),
  ],
  [
    'Anthropic',
    (fi) =>
      new AnthropicEngine({
        apiKey: 'test-key',
        model: 'test-claude',
        timeoutMs: 500,
        fetchImpl: fi,
        maxRetries: 0,
      }),
  ],
];

describe.each(adapters)('DecisionEngine contract — %s', (name, makeEngine) => {
  const pick = (content: string) =>
    name === 'OpenAICompatible' ? openAIResponse(content) : anthropicResponse(content);

  describe('well-formed response', () => {
    it('parses long decision', async () => {
      const engine = makeEngine(async () => pick(VALID_DECISION));
      const result = await engine.decide(baseCtx);
      expect(result).toEqual({ action: 'long', confidence: 0.7 });
    });

    it('parses short decision', async () => {
      const engine = makeEngine(async () => pick(VALID_SHORT));
      const result = await engine.decide(baseCtx);
      expect(result).toEqual({ action: 'short', confidence: 0.9 });
    });

    it('parses hold decision', async () => {
      const engine = makeEngine(async () => pick(VALID_HOLD));
      const result = await engine.decide(baseCtx);
      expect(result).toEqual({ action: 'hold', confidence: 0.5 });
    });

    it('strips markdown code fences', async () => {
      const fenced = '```json\n' + VALID_DECISION + '\n```';
      const engine = makeEngine(async () => pick(fenced));
      const result = await engine.decide(baseCtx);
      expect(result).toEqual({ action: 'long', confidence: 0.7 });
    });
  });

  describe('malformed response', () => {
    it('throws DecisionParseError for non-JSON', async () => {
      const engine = makeEngine(async () => pick('not json'));
      await expect(engine.decide(baseCtx)).rejects.toThrow(DecisionParseError);
    });

    it('throws DecisionParseError for missing action', async () => {
      const engine = makeEngine(async () =>
        pick(JSON.stringify({ confidence: 0.5 })),
      );
      await expect(engine.decide(baseCtx)).rejects.toThrow(DecisionParseError);
    });

    it('throws DecisionParseError for invalid action', async () => {
      const engine = makeEngine(async () =>
        pick(JSON.stringify({ action: 'buy', confidence: 0.5 })),
      );
      await expect(engine.decide(baseCtx)).rejects.toThrow(DecisionParseError);
    });

    it('throws DecisionParseError for out-of-range confidence', async () => {
      const engine = makeEngine(async () =>
        pick(JSON.stringify({ action: 'long', confidence: 1.5 })),
      );
      await expect(engine.decide(baseCtx)).rejects.toThrow(DecisionParseError);
    });

    it('throws DecisionParseError for extra keys (strict schema)', async () => {
      const engine = makeEngine(async () =>
        pick(JSON.stringify({ action: 'hold', confidence: 0.5, size: 100 })),
      );
      await expect(engine.decide(baseCtx)).rejects.toThrow(DecisionParseError);
    });
  });

  describe('timeout', () => {
    it('throws DecisionTimeoutError when fetch never resolves', async () => {
      const engine = makeEngine(neverResolves as unknown as typeof fetch);
      await expect(engine.decide(baseCtx)).rejects.toThrow(DecisionTimeoutError);
    }, 2000);
  });

  describe('safeDecide', () => {
    it('returns hold on DecisionParseError', async () => {
      const engine = makeEngine(async () => pick('garbage'));
      const result = await safeDecide(engine, baseCtx);
      expect(result).toEqual({ action: 'hold', confidence: 0 });
    });

    it('returns hold on timeout', async () => {
      const engine = makeEngine(neverResolves as unknown as typeof fetch);
      const result = await safeDecide(engine, baseCtx);
      expect(result).toEqual({ action: 'hold', confidence: 0 });
    }, 2000);

    it('passes through valid decisions', async () => {
      const engine = makeEngine(async () => pick(VALID_DECISION));
      const result = await safeDecide(engine, baseCtx);
      expect(result).toEqual({ action: 'long', confidence: 0.7 });
    });
  });

  describe('HTTP errors', () => {
    it('throws DecisionError on non-2xx status', async () => {
      const engine = makeEngine(async () => new Response('rate limited', { status: 429 }));
      await expect(engine.decide(baseCtx)).rejects.toThrow(/HTTP 429/);
    });
  });

  describe('provider identity', () => {
    it('exposes provider string', () => {
      const engine = makeEngine(async () => new Response());
      expect(typeof engine.provider).toBe('string');
      expect(engine.provider.length).toBeGreaterThan(0);
    });
  });
});

describe('retry on 429', () => {
  const VALID = JSON.stringify({ action: 'long', confidence: 0.7 });

  function makeOpenAIEngine(
    fetchImpl: typeof fetch,
    maxRetries = 3,
    initialRetryDelayMs = 10,
  ) {
    return new OpenAICompatibleEngine({
      baseURL: 'https://example.test/v1',
      apiKey: 'test-key',
      model: 'test/model',
      timeoutMs: 500,
      fetchImpl,
      maxRetries,
      initialRetryDelayMs,
    });
  }

  function openAIResponse(content: string, status = 200): Response {
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status });
  }

  it('retries on 429 then succeeds', async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls++;
      if (calls <= 2) return new Response('rate limited', { status: 429 });
      return openAIResponse(VALID);
    };
    const engine = makeOpenAIEngine(fetchImpl);
    const result = await engine.decide(baseCtx);
    expect(result).toEqual({ action: 'long', confidence: 0.7 });
    expect(calls).toBe(3);
  });

  it('throws after maxRetries exhausted', async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls++;
      return new Response('rate limited', { status: 429 });
    };
    const engine = makeOpenAIEngine(fetchImpl, 2);
    await expect(engine.decide(baseCtx)).rejects.toThrow(/HTTP 429/);
    expect(calls).toBe(3);
  });

  it('retries on 5xx then succeeds', async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls++;
      if (calls === 1) return new Response('server error', { status: 500 });
      return openAIResponse(VALID);
    };
    const engine = makeOpenAIEngine(fetchImpl);
    const result = await engine.decide(baseCtx);
    expect(result).toEqual({ action: 'long', confidence: 0.7 });
    expect(calls).toBe(2);
  });

  it('does not retry on 4xx (non-429)', async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls++;
      return new Response('bad request', { status: 400 });
    };
    const engine = makeOpenAIEngine(fetchImpl);
    await expect(engine.decide(baseCtx)).rejects.toThrow(/HTTP 400/);
    expect(calls).toBe(1);
  });

  it('does not retry on parse errors', async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls++;
      return openAIResponse('not json');
    };
    const engine = makeOpenAIEngine(fetchImpl);
    await expect(engine.decide(baseCtx)).rejects.toThrow(DecisionParseError);
    expect(calls).toBe(1);
  });

  it('does not retry on timeout', async () => {
    let calls = 0;
    const fetchImpl = async (
      _url: string | URL | Request,
      init?: RequestInit,
    ) => {
      calls++;
      return neverResolves(_url, init);
    };
    const engine = makeOpenAIEngine(fetchImpl);
    await expect(engine.decide(baseCtx)).rejects.toThrow(DecisionTimeoutError);
    expect(calls).toBe(1);
  }, 2000);
});
