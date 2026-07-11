import { describe, it, expect } from 'vitest';
import { rsi, atr, ema } from '@trading/indicators';
import { FeaturePipeline } from '../features.js';
import { featurePipelineVersion } from '../pipeline-version.js';
import { loadGoldenDataset, inMemoryDataset, sampleMetadata } from './helpers.js';
import type { FeatureRow, FeatureSpec } from '../types.js';

const candles = loadGoldenDataset('btc_15m');

const specs: FeatureSpec[] = [
  { name: 'rsi_14', indicator: 'rsi', params: { period: 14 } },
  { name: 'atr_14', indicator: 'atr', params: { period: 14 } },
  { name: 'ema_20', indicator: 'ema', params: { period: 20 } },
  { name: 'return', indicator: 'return' },
];

async function collectRows(pipeline: FeaturePipeline): Promise<FeatureRow[]> {
  const rows: FeatureRow[] = [];
  for await (const row of pipeline.rows()) {
    rows.push(row);
  }
  return rows;
}

function expectSameFeatures(a: Record<string, number>, b: Record<string, number>): void {
  for (const key of Object.keys(a)) {
    if (Number.isNaN(a[key]) && Number.isNaN(b[key])) continue;
    expect(b[key]).toBeCloseTo(a[key], 8);
  }
}

describe('FeaturePipeline', () => {
  it('yields one row per candle in order with the source candle attached', async () => {
    const pipeline = new FeaturePipeline(inMemoryDataset(candles, sampleMetadata), specs);
    const rows = await collectRows(pipeline);
    expect(rows).toHaveLength(candles.length);
    for (let i = 0; i < candles.length; i++) {
      expect(rows[i].index).toBe(i);
      expect(rows[i].candle).toEqual(candles[i]);
    }
  });

  it('final-row indicator values equal the single-call indicator on the full array', async () => {
    const pipeline = new FeaturePipeline(inMemoryDataset(candles, sampleMetadata), specs);
    const rows = await collectRows(pipeline);
    const last = rows[rows.length - 1].features;
    expect(last.rsi_14).toBeCloseTo(rsi(candles, 14).value, 8);
    expect(last.atr_14).toBeCloseTo(atr(candles, 14).value, 8);
    expect(last.ema_20).toBeCloseTo(ema(candles, 20).value, 8);
  });

  it('marks warmup features as NaN and lists them in insufficient', async () => {
    const pipeline = new FeaturePipeline(inMemoryDataset(candles, sampleMetadata), specs);
    const rows = await collectRows(pipeline);
    const warmup = rows[13];
    expect(Number.isNaN(warmup.features.rsi_14)).toBe(true);
    expect(warmup.insufficient).toContain('rsi_14');
    const ready = rows[20];
    expect(Number.isNaN(ready.features.ema_20)).toBe(false);
    expect(ready.insufficient).not.toContain('ema_20');
  });

  it('is deterministic across runs', async () => {
    const a = await collectRows(
      new FeaturePipeline(inMemoryDataset(candles, sampleMetadata), specs),
    );
    const b = await collectRows(
      new FeaturePipeline(inMemoryDataset(candles, sampleMetadata), specs),
    );
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i++) {
      expectSameFeatures(a[i].features, b[i].features);
    }
    const metaA = await new FeaturePipeline(
      inMemoryDataset(candles, sampleMetadata),
      specs,
    ).metadata();
    const metaB = await new FeaturePipeline(
      inMemoryDataset(candles, sampleMetadata),
      specs,
    ).metadata();
    expect(metaA.pipelineVersion).toBe(metaB.pipelineVersion);
  });

  it('produces a 16-char hex pipelineVersion that is stable and spec-sensitive', () => {
    const v1 = featurePipelineVersion(specs, candles);
    expect(v1).toMatch(/^[0-9a-f]{16}$/);
    expect(v1).toBe(featurePipelineVersion(specs, candles));
    const changed = specs.map((s) => (s.name === 'rsi_14' ? { ...s, params: { period: 21 } } : s));
    const v2 = featurePipelineVersion(changed, candles);
    expect(v2).not.toBe(v1);
  });

  it('propagates source dataset metadata untouched', async () => {
    const pipeline = new FeaturePipeline(inMemoryDataset(candles, sampleMetadata), specs);
    const meta = await pipeline.metadata();
    expect(meta.source).toEqual(sampleMetadata);
    expect(meta.source.checksum).toBe(sampleMetadata.checksum);
  });

  it('computes derived features correctly (return is NaN at index 0)', async () => {
    const pipeline = new FeaturePipeline(inMemoryDataset(candles, sampleMetadata), [
      { name: 'return', indicator: 'return' },
    ]);
    const rows = await collectRows(pipeline);
    expect(Number.isNaN(rows[0].features.return)).toBe(true);
    const expected = candles[5].close - candles[4].close;
    expect(rows[5].features.return).toBeCloseTo(expected, 8);
  });

  it('rejects invalid configs (unknown indicator, duplicate name, empty)', () => {
    expect(
      () =>
        new FeaturePipeline(inMemoryDataset(candles, sampleMetadata), [
          { name: 'x', indicator: 'nope' as never },
        ]),
    ).toThrow();
    expect(
      () =>
        new FeaturePipeline(inMemoryDataset(candles, sampleMetadata), [
          { name: 'dup', indicator: 'rsi' },
          { name: 'dup', indicator: 'atr' },
        ]),
    ).toThrow(/duplicate/);
    expect(() => new FeaturePipeline(inMemoryDataset(candles, sampleMetadata), [])).toThrow();
  });

  it('never throws on rows where all features are insufficient', async () => {
    const bigSpecs: FeatureSpec[] = [
      { name: 'sma_200', indicator: 'sma', params: { period: 200 } },
    ];
    const pipeline = new FeaturePipeline(inMemoryDataset(candles, sampleMetadata), bigSpecs);
    const rows = await collectRows(pipeline);
    expect(rows).toHaveLength(candles.length);
    expect(rows.every((r) => Number.isNaN(r.features.sma_200))).toBe(true);
    expect(rows.every((r) => r.insufficient.includes('sma_200'))).toBe(true);
  });
});
