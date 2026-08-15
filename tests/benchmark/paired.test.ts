import { describe, expect, it } from 'vitest';
import type { Candle } from '../../packages/core/src/candle.js';
import type { Dataset } from '../../packages/datasets/src/interfaces.js';
import { forPairedBlocks } from '../../apps/benchmark/src/paired.js';
import type { ProbeResult } from '../../apps/benchmark/src/probe.js';

function upwardDataset(n: number): { dataset: Dataset; candles: Candle[] } {
  const candles: Candle[] = [];
  for (let i = 0; i < n; i++) {
    candles.push({
      timestamp: 1_700_000_000_000 + i * 900_000,
      open: 100 + i,
      high: 103 + i,
      low: 98 + i,
      close: 102 + i,
      volume: 1000,
    });
  }
  return {
    candles,
    dataset: {
      async metadata() {
        return {
          exchange: 'test',
          pair: 'BTC/USDT',
          interval: '15m',
          timezone: 'UTC',
          source: 'test',
          start: candles[0].timestamp,
          end: candles[candles.length - 1].timestamp,
          candleCount: candles.length,
          checksum: 'fake',
          includes: { candles: true, ticker: false, orderbook: false, trades: false },
        };
      },
      async *candles() {
        for (const c of candles) yield c;
      },
    },
  };
}

function probe(ts: number, action: 'long' | 'short' | 'hold'): ProbeResult {
  return {
    timestamp: ts,
    provider: 'fake',
    validJson: true,
    action,
    confidence: 0.8,
    latencyMs: 1,
    costUsd: 0,
  };
}

describe('forPairedBlocks', () => {
  it('is deterministic and yields zero deltas for identical arms', async () => {
    const { dataset, candles } = upwardDataset(40);
    const ts = candles.map((c) => c.timestamp);
    const control = ts.map((t) => probe(t, 'long'));
    const treatment = ts.map((t) => probe(t, 'long'));

    const a = await forPairedBlocks(dataset, control, treatment, { blockSize: 10, seed: 7 });
    const b = await forPairedBlocks(dataset, control, treatment, { blockSize: 10, seed: 7 });
    expect(a).toEqual(b);
    expect(a.sampleSizePerArm).toBe(40);
    expect(a.deltas).toHaveLength(4);
    for (const d of a.deltas) {
      expect(d.pnlDelta).toBe(0);
      expect(d.winRateDelta).toBe(0);
      expect(d.changedDecisions).toBe(0);
    }
    expect(a.pnlDeltaCI95).toEqual([0, 0]);
    expect(a.directionalMcNemar.pValueTwoSided).toBe(1);
    // every decision was long in an up market: both arms correct on every directional sample
    expect(a.directional.treatmentTotal).toBe(39);
    expect(a.directional.treatmentCorrect).toBe(39);
  });

  it('counts discordant pairs where the treatment flips to the wrong direction', async () => {
    const { dataset, candles } = upwardDataset(30);
    const ts = candles.map((c) => c.timestamp);
    const control = ts.map((t) => probe(t, 'long'));
    const treatment = ts.map((t, i) => probe(t, i === 5 || i === 12 ? 'short' : 'long'));

    const result = await forPairedBlocks(dataset, control, treatment, {
      blockSize: 30,
      seed: 1,
    });
    // two flips, both wrong in an up market, both have a next candle (last candle has no next)
    expect(result.directionalMcNemar.controlWins).toBe(2);
    expect(result.directionalMcNemar.treatmentWins).toBe(0);
    // exact two-sided binomial p for k=0, n=2 => 0.5
    expect(result.directionalMcNemar.pValueTwoSided).toBeCloseTo(0.5, 12);
    expect(result.directional.treatmentCorrect).toBe(27);
    expect(result.directional.controlCorrect).toBe(29);
  });

  it('reports changed decisions per block', async () => {
    const { dataset, candles } = upwardDataset(20);
    const ts = candles.map((c) => c.timestamp);
    const control = ts.map((t) => probe(t, 'long'));
    const treatment = ts.map((t, i) => probe(t, i === 3 ? 'short' : 'long'));

    const result = await forPairedBlocks(dataset, control, treatment, { blockSize: 10, seed: 2 });
    expect(result.deltas[0].changedDecisions).toBe(1);
    expect(result.deltas[1].changedDecisions).toBe(0);
  });

  it('different seeds still produce the same mean (bootstrap determinism per seed)', async () => {
    const { dataset, candles } = upwardDataset(60);
    const ts = candles.map((c) => c.timestamp);
    const control = ts.map((t, i) => probe(t, i % 3 === 0 ? 'long' : 'hold'));
    const treatment = ts.map((t, i) =>
      probe(t, i % 3 === 0 ? (i % 6 === 0 ? 'short' : 'long') : 'hold'),
    );

    const r1 = await forPairedBlocks(dataset, control, treatment, { blockSize: 12, seed: 42 });
    const r2 = await forPairedBlocks(dataset, control, treatment, { blockSize: 12, seed: 42 });
    expect(r1.pnlDeltaCI95).toEqual(r2.pnlDeltaCI95);
    expect(r1.deltas).toEqual(r2.deltas);
  });

  it('pairs only timestamps present in both arms', async () => {
    const { dataset, candles } = upwardDataset(40);
    const ts = candles.map((c) => c.timestamp);
    const control = ts.map((t) => probe(t, 'long'));
    // treatment lacks one timestamp entirely — like an orderflow candle with
    // no snapshot; it must not count as a matched pair
    const treatment = ts.filter((t) => t !== ts[10]).map((t) => probe(t, 'long'));

    const result = await forPairedBlocks(dataset, control, treatment, {
      blockSize: 40,
      seed: 1,
    });
    expect(result.sampleSizePerArm).toBe(39);
    expect(result.matchedSamples).toBe(39);
  });

  it('honours a per-dataset minVolume guardrail (rejects low-volume trades)', async () => {
    const { dataset, candles } = upwardDataset(40);
    const ts = candles.map((c) => c.timestamp);
    // flips between long and short force position closes so pnl is realized
    const control = ts.map((t, i) => probe(t, i % 2 === 0 ? 'long' : 'short'));
    const treatment = ts.map((t, i) => probe(t, i % 2 === 0 ? 'long' : 'short'));

    // volume is 1000 in the fixture; a floor of 5000 must reject every fill
    const gated = await forPairedBlocks(dataset, control, treatment, {
      blockSize: 40,
      seed: 3,
      minVolume: 5000,
    });
    expect(gated.deltas[0].controlPnl).toBe(0);
    expect(gated.deltas[0].treatmentPnl).toBe(0);

    // a floor of 1 leaves the same trades passable and the pnl nonzero
    const open = await forPairedBlocks(dataset, control, treatment, {
      blockSize: 40,
      seed: 3,
      minVolume: 1,
    });
    expect(open.deltas[0].controlPnl).not.toBe(0);
  });
});
