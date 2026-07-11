import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Candle } from '@trading/core';
import type { FeatureMetadata, FeatureRow } from './types.js';
import type { FeaturePipeline } from './features.js';

interface DiskFeatureLine {
  index: number;
  features: Record<string, number | null>;
  insufficient: string[];
}

function toDiskLine(row: FeatureRow): DiskFeatureLine {
  const features: Record<string, number | null> = {};
  for (const [key, value] of Object.entries(row.features)) {
    features[key] = Number.isNaN(value) ? null : value;
  }
  return { index: row.index, features, insufficient: row.insufficient };
}

function fromDiskLine(line: DiskFeatureLine, candle: Candle): FeatureRow {
  const features: Record<string, number> = {};
  for (const [key, value] of Object.entries(line.features)) {
    features[key] = value === null ? NaN : value;
  }
  return {
    index: line.index,
    candle,
    features,
    insufficient: line.insufficient,
    metadata: { candlesConsumed: line.index + 1 },
  };
}

export async function writeFeatureDataset(pipeline: FeaturePipeline, dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  const metadata = await pipeline.metadata();

  const candles: Candle[] = [];
  const lines: string[] = [];
  for await (const row of pipeline.rows()) {
    candles.push(row.candle);
    lines.push(JSON.stringify(toDiskLine(row)));
  }

  await writeFile(
    join(dir, 'candles.jsonl'),
    candles.map((c) => JSON.stringify(c)).join('\n') + '\n',
    'utf-8',
  );
  await writeFile(join(dir, 'features.jsonl'), lines.join('\n') + '\n', 'utf-8');
  await writeFile(join(dir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf-8');
}

export interface ReadFeatureDataset {
  metadata: FeatureMetadata;
  rows: FeatureRow[];
}

export async function readFeatureDataset(dir: string): Promise<ReadFeatureDataset> {
  const metaRaw = await readFile(join(dir, 'metadata.json'), 'utf-8');
  const metadata = JSON.parse(metaRaw) as FeatureMetadata;

  const candleRaw = await readFile(join(dir, 'candles.jsonl'), 'utf-8');
  const candles = candleRaw
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l) as Candle);

  const featureRaw = await readFile(join(dir, 'features.jsonl'), 'utf-8');
  const rows = featureRaw
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => fromDiskLine(JSON.parse(l) as DiskFeatureLine, candles[JSON.parse(l).index]));

  return { metadata, rows };
}
