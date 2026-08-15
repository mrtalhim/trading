import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Candle } from '@trading/core';
import { OrderBookSchema, type OrderBook } from '@trading/core';
import type { Dataset, DatasetMetadata } from '../interfaces.js';
import { DatasetMetadataSchema } from '../metadata/metadata.js';

export class JsonlLoader implements Dataset {
  private dir: string;
  private _metadata: DatasetMetadata | undefined;
  private _books: Map<number, OrderBook> | undefined;

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

  /**
   * Returns the order book snapshot whose `timestamp` equals the given
   * timestamp (decision candles are keyed to the snapshot taken at their
   * close), or `null` when the dataset has no `orderbook.jsonl` or no
   * snapshot for that instant.
   */
  async orderbook(timestamp: number): Promise<OrderBook | null> {
    const books = await this.books();
    return books.get(timestamp) ?? null;
  }

  private async books(): Promise<Map<number, OrderBook>> {
    if (this._books) return this._books;
    const map = new Map<number, OrderBook>();
    let raw: string;
    try {
      raw = await readFile(join(this.dir, 'orderbook.jsonl'), 'utf-8');
    } catch {
      // no orderbook data in this dataset — treated as null lookups
      this._books = map;
      return this._books;
    }
    for (const line of raw.split('\n').filter((l) => l.trim() !== '')) {
      const book = OrderBookSchema.parse(JSON.parse(line));
      map.set(book.timestamp, book);
    }
    this._books = map;
    return this._books;
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
