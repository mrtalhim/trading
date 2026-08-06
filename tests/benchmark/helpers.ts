import type { Candle, Decision } from '../../packages/core/src/index.js';
import type { Dataset, DatasetMetadata } from '../../packages/datasets/src/index.js';
import type { DecisionContext, DecisionEngine } from '../../packages/llm/src/index.js';
import { DecisionParseError } from '../../packages/llm/src/index.js';

export function makeCandles(
  count: number,
  startTs = 1_700_000_000_000,
  intervalMs = 15 * 60_000,
): Candle[] {
  return Array.from({ length: count }, (_, i) => {
    const base = 100 + (i % 10);
    return {
      timestamp: startTs + i * intervalMs,
      open: base,
      high: base + 2,
      low: base - 2,
      close: base + (i % 3),
      volume: 10 + (i % 5),
    };
  });
}

export function memoryDataset(candles: Candle[]): Dataset {
  const sorted = [...candles].sort((a, b) => a.timestamp - b.timestamp);
  const meta: DatasetMetadata = {
    exchange: 'test',
    pair: 'BTC/USDT',
    interval: '15m',
    timezone: 'UTC',
    source: 'test',
    start: sorted[0]?.timestamp ?? 0,
    end: sorted[sorted.length - 1]?.timestamp ?? 0,
    candleCount: sorted.length,
    checksum: 'deadbeef',
    includes: { candles: true, ticker: false, orderbook: false, trades: false },
  };
  return {
    metadata: async () => meta,
    candles: async function* () {
      for (const c of sorted) yield c;
    },
  };
}

export class FakeEngine implements DecisionEngine {
  readonly provider: string;
  private readonly respond: (ctx: DecisionContext) => Decision;

  constructor(provider: string, respond: (ctx: DecisionContext) => Decision) {
    this.provider = provider;
    this.respond = respond;
  }

  async decide(ctx: DecisionContext): Promise<Decision> {
    return this.respond(ctx);
  }

  static valid(provider: string, decision: Decision): FakeEngine {
    return new FakeEngine(provider, () => decision);
  }

  static invalid(provider: string, reason = 'invalid json'): FakeEngine {
    return new FakeEngine(provider, () => {
      throw new DecisionParseError(provider, reason, ['invalid JSON']);
    });
  }

  static scripted(provider: string, byTimestamp: Map<number, Decision>): FakeEngine {
    return new FakeEngine(provider, (ctx) => {
      const decision = ctx.timestamp !== undefined ? byTimestamp.get(ctx.timestamp) : undefined;
      if (decision) return decision;
      throw new DecisionParseError(provider, 'no scripted decision', ['unexpected']);
    });
  }
}

export function risingPrices(count: number, startTs = 1_700_000_000_000): Candle[] {
  return Array.from({ length: count }, (_, i) => {
    const close = 100 + i;
    return {
      timestamp: startTs + i * 15 * 60_000,
      open: 100 + i,
      high: 100 + i + 1,
      low: 100 + i - 1,
      close,
      volume: 10,
    };
  });
}
