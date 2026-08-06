import { describe, expect, it } from 'vitest';
import {
  computeWinRate,
  computeMaxDrawdown,
  scoreProbes,
  type ProbeResult,
} from '../../apps/benchmark/src/index.js';
import { memoryDataset, risingPrices } from './helpers.js';

describe('computeWinRate', () => {
  it('wins / closes where closes have non-zero realizedPnl', () => {
    const trades = [
      { realizedPnl: 10 },
      { realizedPnl: -5 },
      { realizedPnl: 0 },
      { realizedPnl: 0 },
      { realizedPnl: 8 },
    ];
    expect(computeWinRate(trades)).toBeCloseTo(2 / 3, 6);
  });

  it('returns 0 for no trades or no closes', () => {
    expect(computeWinRate([])).toBe(0);
    expect(computeWinRate([{ realizedPnl: 0 }, { realizedPnl: 0 }])).toBe(0);
  });
});

describe('computeMaxDrawdown', () => {
  it('computes the max peak-to-trough relative decline', () => {
    expect(
      computeMaxDrawdown([{ equity: 100 }, { equity: 120 }, { equity: 90 }, { equity: 130 }]),
    ).toBeCloseTo((120 - 90) / 120, 6);
  });

  it('handles monotonic up, flat, empty and single-point curves', () => {
    expect(computeMaxDrawdown([{ equity: 80 }, { equity: 90 }, { equity: 100 }])).toBe(0);
    expect(computeMaxDrawdown([{ equity: 100 }, { equity: 100 }])).toBe(0);
    expect(computeMaxDrawdown([])).toBe(0);
    expect(computeMaxDrawdown([{ equity: 100 }])).toBe(0);
  });
});

describe('scoreProbes', () => {
  const candles = risingPrices(80);
  const dataset = memoryDataset(candles);

  function makeProbes(invalidTs: number[] = []): ProbeResult[] {
    const probes: ProbeResult[] = [];
    candles.forEach((c, i) => {
      if (i % 10 !== 0) return;
      const ts = c.timestamp;
      if (invalidTs.includes(ts)) {
        probes.push({
          timestamp: ts,
          provider: 'fake:model',
          preset: 'fake',
          validJson: false,
          action: null,
          confidence: null,
          latencyMs: 1,
          costUsd: 0,
        });
        return;
      }
      probes.push({
        timestamp: ts,
        provider: 'fake:model',
        preset: 'fake',
        validJson: true,
        action: 'hold',
        confidence: 0.5,
        latencyMs: 1,
        costUsd: 0,
      });
    });
    return probes;
  }

  it('maps invalid probes to hold/0 (production safeDecide parity)', async () => {
    const invalidTs = candles[10].timestamp;
    const probes = makeProbes([invalidTs]);
    const score = await scoreProbes(dataset, probes, { symbol: 'BTC/USDT' });

    const outcome = score.backtest.outcomes.find((o) => o.timestamp === invalidTs);
    expect(outcome).toBeDefined();
    expect(outcome!.action).toBe('hold');
    expect(outcome!.allowed).toBe(true);
  });

  it('computes winRate and maxDrawdown from the backtest, deterministically', async () => {
    const probes = makeProbes();
    const s1 = await scoreProbes(dataset, probes, { symbol: 'BTC/USDT' });
    const s2 = await scoreProbes(dataset, probes, { symbol: 'BTC/USDT' });

    expect(s1.provider).toBe('fake:model');
    expect(Number.isFinite(s1.winRate)).toBe(true);
    expect(s1.winRate).toBeGreaterThanOrEqual(0);
    expect(s1.winRate).toBeLessThanOrEqual(1);
    expect(Number.isFinite(s1.maxDrawdown)).toBe(true);
    expect(s1.maxDrawdown).toBeGreaterThanOrEqual(0);
    expect(s1.backtest.checksum).toBe(s2.backtest.checksum);
    expect(s1).toEqual(s2);
  });

  it('all-invalid probes produce winRate 0 and a valid checksum', async () => {
    const probes = makeProbes(candles.map((c) => c.timestamp));
    const score = await scoreProbes(dataset, probes, { symbol: 'BTC/USDT' });
    expect(score.winRate).toBe(0);
    expect(score.backtest.checksum).toMatch(/^[0-9a-f]{16}$/);
  });
});
