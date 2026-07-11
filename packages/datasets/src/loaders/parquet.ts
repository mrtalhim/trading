import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { asyncBufferFromFile, parquetReadObjects } from 'hyparquet';
import type { Candle } from '@trading/core';
import type { Dataset, DatasetMetadata } from '../interfaces.js';
import { DatasetMetadataSchema } from '../metadata/metadata.js';

export class ParquetLoader implements Dataset {
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
    const parquetPath = join(this.dir, 'candles.parquet');
    const file = await asyncBufferFromFile(parquetPath);
    const rows: Record<string, unknown>[] = await parquetReadObjects({ file });
    for (const row of rows) {
      yield {
        timestamp: Number(row.timestamp),
        open: Number(row.open),
        high: Number(row.high),
        low: Number(row.low),
        close: Number(row.close),
        volume: Number(row.volume),
      };
    }
  }
}
