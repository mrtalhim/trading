import { readFile } from 'node:fs/promises';
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
