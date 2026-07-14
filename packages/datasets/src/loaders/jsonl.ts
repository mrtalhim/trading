import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Candle } from '@trading/core';
import type { Dataset, DatasetMetadata } from '../interfaces.js';
import { DatasetMetadataSchema } from '../metadata/metadata.js';

export class JsonlLoader implements Dataset {
  private dir: string;
  private _metadata: DatasetMetadata | undefined;

  constructor(dir: string) {
    this.dir = dir;
  }

  async metadata(): Promise<DatasetMetadata> {
    if (!this._metadata) {
      const raw = await readFile(join(this.dir, 'metadata.json'), 'utf-8');
      this._metadata = DatasetMetadataSchema.parse(JSON.parse(raw));
    }
    return this._metadata;
  }

  async *candles(): AsyncIterable<Candle> {
    const raw = await readFile(join(this.dir, 'candles.jsonl'), 'utf-8');
    const lines = raw.split('\n').filter((l) => l.trim() !== '');
    for (const line of lines) {
      yield JSON.parse(line) as Candle;
    }
  }
}

/**
 * Writes a canonical dataset to disk in the same layout {@link JsonlLoader}
 * reads: a `metadata.json` plus a `candles.jsonl` (one candle per line).
 */
export async function writeJsonlDataset(
  dir: string,
  metadata: DatasetMetadata,
  candles: Candle[],
): Promise<void> {
  const validMetadata = DatasetMetadataSchema.parse(metadata);
  const sorted = [...candles].sort((a, b) => a.timestamp - b.timestamp);
  const lines = sorted.map((c) => JSON.stringify(c)).join('\n') + '\n';
  await writeFile(join(dir, 'metadata.json'), JSON.stringify(validMetadata, null, 2) + '\n');
  await writeFile(join(dir, 'candles.jsonl'), lines);
}
