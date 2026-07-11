import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import { ParquetLoader } from '../loaders/parquet.js';

const PARQUET_FIXTURE_DIR = resolve(import.meta.dirname, 'fixtures-parquet');

const CANDLES = [
  { timestamp: 1700000000000, open: 42000, high: 42500, low: 41800, close: 42300, volume: 100 },
  { timestamp: 1700000900000, open: 42300, high: 42800, low: 42100, close: 42600, volume: 120 },
  { timestamp: 1700001800000, open: 42600, high: 43000, low: 42400, close: 42900, volume: 140 },
  { timestamp: 1700002700000, open: 42900, high: 43200, low: 42700, close: 43100, volume: 160 },
  { timestamp: 1700003600000, open: 43100, high: 43500, low: 42900, close: 43400, volume: 180 },
];

const METADATA = {
  exchange: 'synthetic',
  pair: 'BTCUSDT',
  interval: '15m',
  timezone: 'UTC',
  source: 'test-fixture',
  start: 1700000000000,
  end: 1700003600000,
  candleCount: 5,
  checksum: 'test-checksum-parquet',
  includes: { candles: true, ticker: false, orderbook: false, trades: false },
};

async function setupParquetFixture() {
  await mkdir(PARQUET_FIXTURE_DIR, { recursive: true });
  await writeFile(resolve(PARQUET_FIXTURE_DIR, 'metadata.json'), JSON.stringify(METADATA, null, 2));

  const { parquetWriteBuffer } = await import('hyparquet-writer');
  const buffer = parquetWriteBuffer({
    columnData: [
      { name: 'timestamp', data: CANDLES.map((c) => BigInt(c.timestamp)), type: 'INT64' },
      { name: 'open', data: CANDLES.map((c) => c.open), type: 'DOUBLE' },
      { name: 'high', data: CANDLES.map((c) => c.high), type: 'DOUBLE' },
      { name: 'low', data: CANDLES.map((c) => c.low), type: 'DOUBLE' },
      { name: 'close', data: CANDLES.map((c) => c.close), type: 'DOUBLE' },
      { name: 'volume', data: CANDLES.map((c) => c.volume), type: 'DOUBLE' },
    ],
  });
  await writeFile(resolve(PARQUET_FIXTURE_DIR, 'candles.parquet'), new Uint8Array(buffer));
}

await setupParquetFixture();

describe('ParquetLoader', () => {
  it('loads metadata from metadata.json', async () => {
    const loader = new ParquetLoader(PARQUET_FIXTURE_DIR);
    const meta = await loader.metadata();
    expect(meta.exchange).toBe('synthetic');
    expect(meta.pair).toBe('BTCUSDT');
    expect(meta.candleCount).toBe(5);
  });

  it('streams candles from candles.parquet', async () => {
    const loader = new ParquetLoader(PARQUET_FIXTURE_DIR);
    const candles: {
      timestamp: number;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }[] = [];
    for await (const c of loader.candles()) {
      candles.push(c);
    }
    expect(candles).toHaveLength(5);
    expect(candles[0].timestamp).toBe(1700000000000);
    expect(candles[0].open).toBe(42000);
    expect(candles[4].close).toBe(43400);
  });

  it('produces same data as JsonlLoader', async () => {
    const { JsonlLoader } = await import('../loaders/jsonl.js');
    const parquetLoader = new ParquetLoader(PARQUET_FIXTURE_DIR);
    const jsonlLoader = new JsonlLoader(resolve(import.meta.dirname, 'fixtures'));

    const parquetCandles: {
      timestamp: number;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }[] = [];
    for await (const c of parquetLoader.candles()) {
      parquetCandles.push(c);
    }

    const jsonlCandles: {
      timestamp: number;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }[] = [];
    for await (const c of jsonlLoader.candles()) {
      jsonlCandles.push(c);
    }

    expect(parquetCandles).toEqual(jsonlCandles);
  });
});
