import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'csv-parse/sync';
import type { Candle } from '@trading/core';
import type { Dataset, DatasetMetadata } from '../interfaces.js';
import { DatasetMetadataSchema } from '../metadata/metadata.js';

export class CsvLoader implements Dataset {
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
    const raw = await readFile(join(this.dir, 'candles.csv'), 'utf-8');
    const records: Record<string, string>[] = parse(raw, {
      columns: true,
      skip_empty_lines: true,
      cast: true,
    });
    for (const record of records) {
      yield {
        timestamp: Number(record.timestamp),
        open: Number(record.open),
        high: Number(record.high),
        low: Number(record.low),
        close: Number(record.close),
        volume: Number(record.volume),
      };
    }
  }
}
