import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Candle } from '@trading/core';
import { DatasetRecorderImpl, JsonlLoader, type CandleSource } from '../index.js';

const INTERVAL_MS = 60_000;

function makeCandles(n: number): Candle[] {
  const out: Candle[] = [];
  let price = 100;
  for (let i = 0; i < n; i++) {
    const open = price;
    const close = price + (i % 2 === 0 ? 1 : -1);
    out.push({
      timestamp: 1_000_000 + i * INTERVAL_MS,
      open,
      high: Math.max(open, close) + 1,
      low: Math.min(open, close) - 1,
      close,
      volume: 100 + i,
    });
    price = close;
  }
  return out;
}

function sourceFrom(candles: Candle[]): CandleSource {
  return async function* () {
    for (const c of candles) yield c;
  };
}

describe('DatasetRecorderImpl', () => {
  let dir: string | undefined;

  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it('records a canonical dataset and round-trips through JsonlLoader', async () => {
    dir = await mkdtemp(join(tmpdir(), 'rec-'));
    const candles = makeCandles(10);
    const recorder = new DatasetRecorderImpl(sourceFrom(candles));

    await recorder.start({
      exchange: 'paper',
      pair: 'BTCUSDT',
      interval: '1m',
      outputPath: dir,
    });
    const { metadata, path } = await recorder.stop();

    expect(path).toBe(dir);
    expect(metadata.candleCount).toBe(10);
    expect(metadata.interval).toBe('1m');
    expect(metadata.start).toBe(candles[0].timestamp);
    expect(metadata.end).toBe(candles[candles.length - 1].timestamp);
    expect(metadata.checksum).toHaveLength(16);

    const reloaded = new JsonlLoader(dir);
    const reMeta = await reloaded.metadata();
    expect(reMeta.checksum).toBe(metadata.checksum);
    const reCandles = [];
    for await (const c of reloaded.candles()) reCandles.push(c);
    expect(reCandles).toHaveLength(10);
    expect(reCandles[0]).toEqual(candles[0]);
    expect(reCandles[9]).toEqual(candles[9]);
  });

  it('produces a deterministic checksum for the same candles', async () => {
    const candles = makeCandles(10);
    const a = await recordTo(tempDir(), candles);
    const b = await recordTo(tempDir(), candles);
    expect(a.metadata.checksum).toBe(b.metadata.checksum);
  });

  it('rejects recording with invalid candles', async () => {
    dir = await mkdtemp(join(tmpdir(), 'rec-'));
    const bad: Candle[] = [
      { timestamp: 1000, open: 100, high: 90, low: 80, close: 95, volume: 10 },
    ];
    const recorder = new DatasetRecorderImpl(sourceFrom(bad));
    await recorder.start({
      exchange: 'paper',
      pair: 'BTCUSDT',
      interval: '1m',
      outputPath: dir,
    });
    await expect(recorder.stop()).rejects.toThrow(/invalid/);
  });
});

let counter = 0;
function tempDir(): string {
  return join(tmpdir(), `rec-${process.pid}-${counter++}`);
}

async function recordTo(outDir: string, candles: Candle[]) {
  const recorder = new DatasetRecorderImpl(sourceFrom(candles));
  await recorder.start({
    exchange: 'paper',
    pair: 'BTCUSDT',
    interval: '1m',
    outputPath: outDir,
  });
  return recorder.stop();
}
