import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Candle } from '../../packages/core/src/index.js';
import { JsonlLoader } from '../../packages/datasets/src/index.js';
import type { RecordedDecision } from '../../apps/backtest/src/decisions.js';
import { AgentEngine, type AgentDeps } from '../../apps/indodax-agent/src/engine.js';
import type { AgentConfig } from '../../apps/indodax-agent/src/config.js';
import type { AgentCommand } from '../../apps/indodax-agent/src/signal.js';

const GOLDEN = 'datasets/golden/btc_15m';

function makeDecisions(candles: Candle[], step = 10): RecordedDecision[] {
  const decisions: RecordedDecision[] = [];
  for (let i = step; i < candles.length; i += step) {
    decisions.push({
      timestamp: candles[i].timestamp,
      action: i % 20 === 0 ? 'long' : 'short',
      confidence: 0.95,
    });
  }
  return decisions;
}

function baseConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    mode: 'paper',
    pair: 'BTC/IDR',
    base: 'btc',
    quote: 'idr',
    interval: '15m',
    initialQuote: 10_000_000,
    feeRate: 0.002,
    sizing: { fraction: 0.1, maxPositionFraction: 0.3 },
    atrStopMultiplier: 2,
    minNotionalIdr: 10_000,
    dailyBudgetIdr: 500_000_000,
    ownerId: 'test-agent',
    runDir: '',
    stateDir: '',
    reconcileEveryCandles: 500,
    commandCheckEveryCandles: 25,
    ...overrides,
  };
}

const tmpDirs: string[] = [];
async function tempDir(): Promise<string> {
  const d = await mkdtemp(join(tmpdir(), 'engine-'));
  tmpDirs.push(d);
  return d;
}

afterEach(async () => {
  while (tmpDirs.length > 0) {
    const d = tmpDirs.pop()!;
    await rm(d, { recursive: true, force: true });
  }
});

async function makeEngine(
  overrides: Partial<AgentConfig> = {},
  deps: Partial<AgentDeps> = {},
): Promise<AgentEngine> {
  const dir = await tempDir();
  return new AgentEngine(
    { ...baseConfig(overrides), runDir: join(dir, 'run'), stateDir: join(dir, 'state') },
    { clock: { skewMs: () => 0, now: () => 1_700_000_000_000 }, ...deps },
  );
}

async function loadCandles(): Promise<Candle[]> {
  const dataset = new JsonlLoader(GOLDEN);
  const candles: Candle[] = [];
  for await (const c of dataset.candles()) candles.push(c);
  return candles;
}

describe('AgentEngine (paper loop)', () => {
  it('runs deterministically: two runs produce identical trades, PnL, and checksum', async () => {
    const dataset = new JsonlLoader(GOLDEN);
    const candles = await loadCandles();
    const decisions = makeDecisions(candles);
    const results = [];
    for (let i = 0; i < 2; i++) {
      const engine = await makeEngine();
      results.push(await engine.run({ dataset, decisions }));
    }

    expect(results[0].checksum).toBe(results[1].checksum);
    expect(results[0].trades).toEqual(results[1].trades);
    expect(results[0].realizedPnl).toBe(results[1].realizedPnl);
    expect(results[0].tradeCount).toBeGreaterThan(0);
  });

  it('produces no NaN anywhere in the result', async () => {
    const dataset = new JsonlLoader(GOLDEN);
    const candles = await loadCandles();
    const decisions = makeDecisions(candles);
    const engine = await makeEngine();
    const result = await engine.run({ dataset, decisions });

    for (const v of [
      result.realizedPnl,
      result.totalFees,
      result.finalQuoteFree,
      result.finalPosition,
      result.finalPortfolioValue,
      result.initialQuote,
    ]) {
      expect(Number.isNaN(v)).toBe(false);
    }
    for (const t of result.trades) {
      expect(Number.isNaN(t.price)).toBe(false);
      expect(Number.isNaN(t.quantity)).toBe(false);
      expect(Number.isNaN(t.fee)).toBe(false);
      expect(Number.isNaN(t.realizedPnl)).toBe(false);
    }
    expect(result.trades.length).toBeGreaterThan(0);
  });

  it('never produces a duplicate clientOrderId', async () => {
    const dataset = new JsonlLoader(GOLDEN);
    const candles = await loadCandles();
    const decisions = makeDecisions(candles, 5);
    const engine = await makeEngine();
    const result = await engine.run({ dataset, decisions });
    const ids = result.trades.map((t) => t.clientOrderId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('rejects trades past the daily budget cap', async () => {
    const dataset = new JsonlLoader(GOLDEN);
    const candles = await loadCandles();
    const decisions = makeDecisions(candles, 5);
    const engine = await makeEngine({ dailyBudgetIdr: 1 });
    const result = await engine.run({ dataset, decisions });
    expect(result.guardrailViolations.budget_cap).toBeGreaterThan(0);
    expect(result.tradeCount).toBe(0);
  });

  it('rejects sizes below the minimum notional', async () => {
    const dataset = new JsonlLoader(GOLDEN);
    const candles = await loadCandles();
    const decisions = makeDecisions(candles, 5);
    const engine = await makeEngine({ minNotionalIdr: 9e15 });
    const result = await engine.run({ dataset, decisions });
    expect(result.guardrailViolations.below_min_notional).toBeGreaterThan(0);
    expect(result.tradeCount).toBe(0);
  });

  it('respects pause/resume/status/shutdown signal files', async () => {
    const dataset = new JsonlLoader(GOLDEN);
    const candles = await loadCandles();
    const decisions = makeDecisions(candles, 3);

    const commands: { at: number; command: string }[] = [
      { at: 15, command: 'pause' },
      { at: 30, command: 'resume' },
      { at: 60, command: 'shutdown' },
    ];
    let commandIndex = 0;
    let reads = 0;

    const engine = await makeEngine(
      { commandCheckEveryCandles: 1 },
      {
        readCommand: async () => {
          reads += 1;
          const next = commands[commandIndex];
          if (next && reads === next.at + 1) {
            commandIndex += 1;
            return next.command as AgentCommand;
          }
          return null;
        },
        clearCommand: async () => {},
        writeStatusFn: async () => {},
      },
    );

    const result = await engine.run({ dataset, decisions });

    expect(result.outcomes.length).toBeLessThan(candles.length);
    expect(result.outcomes.some((o) => o.violated.includes('paused'))).toBe(true);
    expect(reads).toBeLessThanOrEqual(candles.length);
  });
});
