import { describe, it, expect } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FeaturePipeline, writeFeatureDataset, readFeatureDataset } from '../index.js';
import { loadGoldenDataset, inMemoryDataset, sampleMetadata } from './helpers.js';
import type { FeatureSpec } from '../types.js';

const candles = loadGoldenDataset('btc_15m');
const specs: FeatureSpec[] = [
  { name: 'rsi_14', indicator: 'rsi', params: { period: 14 } },
  { name: 'return', indicator: 'return' },
];

async function readText(dir: string, file: string): Promise<string> {
  return readFile(join(dir, file), 'utf-8');
}

describe('writeFeatureDataset', () => {
  it('round-trips rows and metadata with NaN handled as null', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'feat-'));
    try {
      const pipeline = new FeaturePipeline(inMemoryDataset(candles, sampleMetadata), specs);
      await writeFeatureDataset(pipeline, dir);

      const { metadata, rows } = await readFeatureDataset(dir);
      expect(metadata.source).toEqual(sampleMetadata);
      expect(rows).toHaveLength(candles.length);
      for (let i = 0; i < rows.length; i++) {
        expect(rows[i].candle).toEqual(candles[i]);
        for (const [key, value] of Object.entries(rows[i].features)) {
          const expected = i === 0 && key === 'return' ? NaN : value;
          if (Number.isNaN(expected)) {
            expect(Number.isNaN(value)).toBe(true);
          } else {
            expect(value).toBeCloseTo(expected, 8);
          }
        }
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('writes byte-identical features.jsonl and metadata.json across two runs', async () => {
    const dirA = await mkdtemp(join(tmpdir(), 'featA-'));
    const dirB = await mkdtemp(join(tmpdir(), 'featB-'));
    try {
      const pipelineA = new FeaturePipeline(inMemoryDataset(candles, sampleMetadata), specs);
      const pipelineB = new FeaturePipeline(inMemoryDataset(candles, sampleMetadata), specs);
      await writeFeatureDataset(pipelineA, dirA);
      await writeFeatureDataset(pipelineB, dirB);

      expect(await readText(dirA, 'features.jsonl')).toBe(await readText(dirB, 'features.jsonl'));
      expect(await readText(dirA, 'metadata.json')).toBe(await readText(dirB, 'metadata.json'));
      expect(await readText(dirA, 'candles.jsonl')).toBe(await readText(dirB, 'candles.jsonl'));
    } finally {
      await rm(dirA, { recursive: true, force: true });
      await rm(dirB, { recursive: true, force: true });
    }
  });
});
