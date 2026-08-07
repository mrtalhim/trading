import { describe, it, expect } from 'vitest';
import type { Decision } from '../../packages/core/src/decision.js';
import type { DecisionEngine, DecisionContext } from '../../packages/llm/src/interfaces.js';
import type { Dataset } from '../../packages/datasets/src/interfaces.js';
import type { Candle } from '../../packages/core/src/candle.js';
import { recordDecisions, writeDecisions } from '../../apps/backtest/src/record.js';
import type { RecordedDecision } from '../../apps/backtest/src/decisions.js';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';

function fakeDataset(candles: Candle[]): Dataset {
  return {
    async metadata() {
      return {
        exchange: 'test',
        pair: 'BTC/USDT',
        interval: '15m',
        timezone: 'UTC',
        source: 'test',
        start: candles[0]?.timestamp ?? 0,
        end: candles[candles.length - 1]?.timestamp ?? 0,
        candleCount: candles.length,
        checksum: 'fake',
        includes: { candles: true, ticker: false, orderbook: false, trades: false },
      };
    },
    async *candles() {
      for (const c of candles) yield c;
    },
  };
}

function fakeEngine(responses: Decision[]): DecisionEngine & { calls: DecisionContext[] } {
  let idx = 0;
  const calls: DecisionContext[] = [];
  return {
    provider: 'fake',
    calls,
    async decide(ctx: DecisionContext): Promise<Decision> {
      calls.push(ctx);
      const r = responses[idx % responses.length];
      idx++;
      return r;
    },
  };
}

const baseCandles: Candle[] = Array.from({ length: 10 }, (_, i) => ({
  timestamp: 1_700_000_000_000 + i * 900_000,
  open: 100 + i,
  high: 102 + i,
  low: 99 + i,
  close: 101 + i,
  volume: 1000 + i * 10,
}));

describe('recordDecisions', () => {
  it('produces one RecordedDecision per sampled candle', async () => {
    const ds = fakeDataset(baseCandles);
    const engine = fakeEngine([
      { action: 'long', confidence: 0.8 },
      { action: 'hold', confidence: 0.5 },
      { action: 'short', confidence: 0.7 },
    ]);
    const decisions = await recordDecisions(ds, engine, {
      symbol: 'BTC/USDT',
      requestDelayMs: 0,
    });
    expect(decisions).toHaveLength(10);
    expect(decisions[0]).toEqual({
      timestamp: baseCandles[0].timestamp,
      action: 'long',
      confidence: 0.8,
    });
    expect(decisions[1]).toEqual({
      timestamp: baseCandles[1].timestamp,
      action: 'hold',
      confidence: 0.5,
    });
  });

  it('respects sampleEvery', async () => {
    const ds = fakeDataset(baseCandles);
    const engine = fakeEngine([{ action: 'hold', confidence: 1 }]);
    const decisions = await recordDecisions(ds, engine, {
      sampleEvery: 3,
      symbol: 'BTC/USDT',
      requestDelayMs: 0,
    });
    expect(decisions).toHaveLength(4);
    expect(decisions[0].timestamp).toBe(baseCandles[0].timestamp);
    expect(decisions[1].timestamp).toBe(baseCandles[3].timestamp);
  });

  it('handles engine errors gracefully via safeDecide', async () => {
    const ds = fakeDataset(baseCandles);
    const engine: DecisionEngine = {
      provider: 'failing',
      async decide() {
        throw new Error('provider down');
      },
    };
    const decisions = await recordDecisions(ds, engine, {
      sampleEvery: 5,
      symbol: 'BTC/USDT',
      requestDelayMs: 0,
    });
    expect(decisions).toHaveLength(2);
    expect(decisions.every((d) => d.action === 'hold')).toBe(true);
  });

  it('includes timestamps from source candles', async () => {
    const ds = fakeDataset(baseCandles);
    const engine = fakeEngine([{ action: 'long', confidence: 0.6 }]);
    const decisions = await recordDecisions(ds, engine, {
      sampleEvery: 10,
      symbol: 'BTC/USDT',
      requestDelayMs: 0,
    });
    expect(decisions[0].timestamp).toBe(baseCandles[0].timestamp);
  });

  it('renders indicator and pattern blocks when context=patterns', async () => {
    const ds = fakeDataset(baseCandles);
    const engine = fakeEngine([{ action: 'hold', confidence: 0.5 }]);
    await recordDecisions(ds, engine, {
      sampleEvery: 3,
      symbol: 'BTC/USDT',
      requestDelayMs: 0,
      context: 'patterns',
    });
    const calls = engine.calls;
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0].userPrompt).toContain('Indicators:');
    expect(calls[0].userPrompt).toContain('Patterns:');
  });

  it('keeps baseline prompts free of blocks', async () => {
    const ds = fakeDataset(baseCandles);
    const engine = fakeEngine([{ action: 'hold', confidence: 0.5 }]);
    await recordDecisions(ds, engine, {
      sampleEvery: 3,
      symbol: 'BTC/USDT',
      requestDelayMs: 0,
      context: 'baseline',
    });
    expect(engine.calls[0].userPrompt).not.toContain('Indicators:');
    expect(engine.calls[0].userPrompt).not.toContain('Patterns:');
  });
});

describe('writeDecisions', () => {
  it('writes JSONL format', async () => {
    const path = join(tmpdir(), `decisions-test-${Date.now()}.jsonl`);
    const decisions: RecordedDecision[] = [
      { timestamp: 1000, action: 'long', confidence: 0.7 },
      { timestamp: 2000, action: 'hold', confidence: 0.5 },
    ];
    await writeDecisions(decisions, path);
    const raw = await readFile(path, 'utf-8');
    const lines = raw.trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0])).toEqual(decisions[0]);
    expect(JSON.parse(lines[1])).toEqual(decisions[1]);
  });
});

describe('recordDecisions delay', () => {
  it('applies delay between requests', async () => {
    const ds = fakeDataset(baseCandles);
    const engine = fakeEngine([{ action: 'hold', confidence: 0.5 }]);
    const start = Date.now();
    await recordDecisions(ds, engine, {
      sampleEvery: 3,
      requestDelayMs: 50,
      symbol: 'BTC/USDT',
    });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(100);
  });
});
