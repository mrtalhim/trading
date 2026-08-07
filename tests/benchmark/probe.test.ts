import { describe, expect, it } from 'vitest';
import {
  DecisionError,
  DecisionParseError,
  DecisionTimeoutError,
} from '../../packages/llm/src/index.js';
import { computeCostUsd, probeDecisions, probeStats } from '../../apps/benchmark/src/index.js';
import { memoryDataset, makeCandles, FakeEngine } from './helpers.js';

describe('probeDecisions', () => {
  const candles = makeCandles(100);
  const dataset = memoryDataset(candles);
  const ts = [candles[10].timestamp, candles[30].timestamp];

  it('returns one result per (timestamp × repeat)', async () => {
    const engine = FakeEngine.valid('fake:model', { action: 'long', confidence: 0.7 });
    const results = await probeDecisions(dataset, engine, ts, {
      lookback: 5,
      repeats: 3,
      requestDelayMs: 0,
    });
    expect(results).toHaveLength(6);
    for (const r of results) {
      expect(r.provider).toBe('fake:model');
      expect(r.validJson).toBe(true);
      expect(r.action).toBe('long');
      expect(r.confidence).toBe(0.7);
      expect(r.latencyMs).toBeGreaterThanOrEqual(0);
      expect(r.costUsd).toBe(0);
    }
  });

  it('marks malformed responses invalid without crashing', async () => {
    const engine = FakeEngine.invalid('fake:model');
    const results = await probeDecisions(dataset, engine, ts, {
      lookback: 5,
      repeats: 1,
      requestDelayMs: 0,
    });
    expect(results).toHaveLength(2);
    for (const r of results) {
      expect(r.validJson).toBe(false);
      expect(r.errorKind).toBe('malformed_json');
      expect(r.action).toBeNull();
      expect(r.confidence).toBeNull();
    }
  });

  it('records a distinct errorKind per failure class', async () => {
    const cases: Array<[Error, string]> = [
      [new DecisionTimeoutError('fake:model', 5000), 'timeout'],
      [new DecisionError('fake:model', 'HTTP 429: too many requests'), 'rate_limited'],
      [new DecisionError('fake:model', 'HTTP 503: unavailable'), 'http_error'],
      [new TypeError('fetch failed'), 'network_error'],
      [new Error('something unexpected'), 'fatal'],
    ];
    for (const [err, expected] of cases) {
      const engine = new FakeEngine('fake:model', () => {
        throw err;
      });
      const results = await probeDecisions(dataset, engine, [ts[0]], {
        lookback: 5,
        repeats: 1,
        requestDelayMs: 0,
      });
      expect(results[0].validJson).toBe(false);
      expect(results[0].errorKind).toBe(expected);
      expect(results[0].errorMessage).toContain(String(err.message.slice(0, 10)));
    }
  });

  it('records errorKind null on success and omits errorMessage', async () => {
    const engine = FakeEngine.valid('fake:model', { action: 'long', confidence: 0.7 });
    const results = await probeDecisions(dataset, engine, [ts[0]], {
      lookback: 5,
      repeats: 1,
      requestDelayMs: 0,
    });
    expect(results[0].validJson).toBe(true);
    expect(results[0].errorKind).toBeNull();
    expect(results[0].errorMessage).toBeUndefined();
  });

  it('builds the same context window as the record path', async () => {
    const seen: string[] = [];
    const engine = new FakeEngine('fake:model', (ctx) => {
      seen.push(ctx.userPrompt);
      return { action: 'hold', confidence: 0.5 };
    });
    await probeDecisions(dataset, engine, [candles[10].timestamp], {
      lookback: 5,
      repeats: 1,
      requestDelayMs: 0,
    });
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain('t=' + candles[6].timestamp);
    expect(seen[0]).toContain('t=' + candles[10].timestamp);
    expect(seen[0]).not.toContain('t=' + candles[5].timestamp);
  });

  it('throws a clear error for a timestamp missing from the dataset', async () => {
    const engine = FakeEngine.valid('fake:model', { action: 'hold', confidence: 0.5 });
    await expect(
      probeDecisions(dataset, engine, [1], { lookback: 5, repeats: 1, requestDelayMs: 0 }),
    ).rejects.toThrow(/not found/i);
  });

  it('is deterministic except latency', async () => {
    const engine = FakeEngine.valid('fake:model', { action: 'long', confidence: 0.7 });
    const r1 = await probeDecisions(dataset, engine, ts, {
      lookback: 5,
      repeats: 2,
      requestDelayMs: 0,
    });
    const r2 = await probeDecisions(dataset, engine, ts, {
      lookback: 5,
      repeats: 2,
      requestDelayMs: 0,
    });
    for (let i = 0; i < r1.length; i++) {
      const a = Object.fromEntries(Object.entries(r1[i]).filter(([key]) => key !== 'latencyMs'));
      const b = Object.fromEntries(Object.entries(r2[i]).filter(([key]) => key !== 'latencyMs'));
      expect(a).toEqual(b);
    }
  });
});

describe('probeStats', () => {
  const candles = makeCandles(20);
  const dataset = memoryDataset(candles);
  const ts = [candles[5].timestamp, candles[10].timestamp];

  it('consistency: all repeats agree → consistent context', async () => {
    const engine = FakeEngine.valid('fake:model', { action: 'long', confidence: 0.7 });
    const probes = await probeDecisions(dataset, engine, ts, {
      lookback: 5,
      repeats: 3,
      requestDelayMs: 0,
    });
    const stats = probeStats(probes);
    expect(stats.consistency).toBe(1);
    expect(stats.validJsonRate).toBe(1);
    expect(stats.samples).toBe(6);
  });

  it('consistency: a context with any failed repeat is inconsistent', async () => {
    const engine = new FakeEngine('fake:model', (ctx) => {
      if (ctx.timestamp === ts[0]) throw new DecisionParseError('fake:model', 'boom', ['invalid']);
      return { action: 'long', confidence: 0.7 };
    });
    const probes = await probeDecisions(dataset, engine, ts, {
      lookback: 5,
      repeats: 2,
      requestDelayMs: 0,
    });
    const stats = probeStats(probes);
    expect(stats.consistency).toBe(0.5);
  });

  it('consistency: disagreeing repeats are inconsistent', async () => {
    let call = 0;
    const engine = new FakeEngine('fake:model', () => {
      call++;
      return call % 2 === 1
        ? { action: 'long', confidence: 0.7 }
        : { action: 'hold', confidence: 0.5 };
    });
    const probes = await probeDecisions(dataset, engine, ts, {
      lookback: 5,
      repeats: 2,
      requestDelayMs: 0,
    });
    const stats = probeStats(probes);
    expect(stats.consistency).toBe(0);
  });

  it('groups validJsonRate, meanLatencyMs and costUsd per provider', async () => {
    const engine = FakeEngine.valid('fake:model', { action: 'hold', confidence: 0.5 });
    const probes = await probeDecisions(dataset, engine, ts, {
      lookback: 5,
      repeats: 2,
      requestDelayMs: 0,
    });
    const stats = probeStats(probes);
    expect(stats.provider).toBe('fake:model');
    expect(stats.validJsonRate).toBe(1);
    expect(stats.meanLatencyMs).toBeGreaterThanOrEqual(0);
    expect(stats.costUsd).toBe(0);
  });

  it('returns zeros for an empty probe set', () => {
    const stats = probeStats([]);
    expect(stats.validJsonRate).toBe(0);
    expect(stats.consistency).toBe(0);
    expect(stats.samples).toBe(0);
  });
});

describe('cost tracking', () => {
  const candles = makeCandles(20);
  const dataset = memoryDataset(candles);
  const ts = [candles[5].timestamp, candles[10].timestamp];

  it('computes costUsd from usage and costModel per probe', async () => {
    const engine = new FakeEngine('fake:paid', () => ({ action: 'long', confidence: 0.7 }), {
      costModel: { promptPerMillionUsd: 1, completionPerMillionUsd: 2 },
      usage: { promptTokens: 500, completionTokens: 200, totalTokens: 700 },
    });
    const probes = await probeDecisions(dataset, engine, ts, {
      lookback: 5,
      repeats: 2,
      requestDelayMs: 0,
    });
    const expected = (500 / 1_000_000) * 1 + (200 / 1_000_000) * 2;
    for (const p of probes) {
      expect(p.costUsd).toBeCloseTo(expected, 12);
    }
    expect(probeStats(probes).costUsd).toBeCloseTo(expected * 4, 12);
  });

  it('records zero cost for a free engine without usage', async () => {
    const engine = FakeEngine.valid('fake:free', { action: 'hold', confidence: 0.5 });
    const probes = await probeDecisions(dataset, engine, ts, {
      lookback: 5,
      repeats: 1,
      requestDelayMs: 0,
    });
    for (const p of probes) expect(p.costUsd).toBe(0);
  });

  it('records zero cost when the probe fails', async () => {
    const engine = new FakeEngine(
      'fake:paid',
      () => {
        throw new DecisionParseError('fake:paid', 'boom', ['invalid']);
      },
      {
        costModel: { promptPerMillionUsd: 1, completionPerMillionUsd: 2 },
        usage: { promptTokens: 500, completionTokens: 200, totalTokens: 700 },
      },
    );
    const probes = await probeDecisions(dataset, engine, ts, {
      lookback: 5,
      repeats: 1,
      requestDelayMs: 0,
    });
    for (const p of probes) {
      expect(p.validJson).toBe(false);
      expect(p.costUsd).toBe(0);
    }
  });
});

describe('computeCostUsd', () => {
  const COST = { promptPerMillionUsd: 1, completionPerMillionUsd: 2 };
  const USAGE = { promptTokens: 1_000_000, completionTokens: 500_000, totalTokens: 1_500_000 };

  it('returns 0 when usage is null', () => {
    expect(computeCostUsd(null, COST)).toBe(0);
  });

  it('returns 0 when costModel is undefined', () => {
    expect(computeCostUsd(USAGE, undefined)).toBe(0);
  });

  it('computes prompt and completion cost from per-million prices', () => {
    expect(computeCostUsd(USAGE, COST)).toBeCloseTo(2, 12);
  });
});
