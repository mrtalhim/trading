import { describe, expect, it } from 'vitest';
import { DecisionParseError } from '../../packages/llm/src/index.js';
import { probeDecisions, probeStats } from '../../apps/benchmark/src/index.js';
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
      expect(r.action).toBeNull();
      expect(r.confidence).toBeNull();
    }
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
