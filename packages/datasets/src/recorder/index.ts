import { mkdir } from 'node:fs/promises';
import type { Candle } from '@trading/core';
import type { DatasetMetadata } from '../interfaces.js';
import { writeJsonlDataset } from '../loaders/jsonl.js';
import { computeChecksum } from '../metadata/checksum.js';
import { validateCandles } from '../validator/index.js';
import type { CandleSource, DatasetRecorder, RecordingConfig } from './interface.js';

export type { DatasetRecorder, RecordingConfig, CandleSource } from './interface.js';

export class DatasetRecorderImpl implements DatasetRecorder {
  private readonly source: CandleSource;
  private readonly buffer: Candle[] = [];
  private running = false;
  private config: RecordingConfig | undefined;
  private abort: AbortController | undefined;
  private loop: Promise<void> | undefined;

  constructor(source: CandleSource) {
    this.source = source;
  }

  async start(config: RecordingConfig): Promise<void> {
    if (this.running) throw new Error('recorder already running');
    this.config = config;
    this.buffer.length = 0;
    this.running = true;
    this.abort = new AbortController();
    this.loop = this.consume();
  }

  private async consume(): Promise<void> {
    const config = this.config!;
    const signal = this.abort!.signal;
    try {
      for await (const candle of this.source(config, signal)) {
        this.buffer.push(candle);
      }
    } finally {
      this.running = false;
    }
  }

  async stop(): Promise<{ metadata: DatasetMetadata; path: string }> {
    if (!this.config) throw new Error('recorder not started');
    this.abort?.abort();
    if (this.loop) await this.loop;

    const config = this.config;
    const candles = [...this.buffer].sort((a, b) => a.timestamp - b.timestamp);
    const validation = validateCandles(candles, config.interval);
    if (!validation.valid) {
      throw new Error(`recorded candles invalid: ${validation.errors.join('; ')}`);
    }

    const checksum = computeChecksum(candles);
    const metadata: DatasetMetadata = {
      exchange: config.exchange,
      pair: config.pair,
      interval: config.interval,
      timezone: 'UTC',
      source: config.exchange,
      start: candles[0]?.timestamp ?? 0,
      end: candles[candles.length - 1]?.timestamp ?? 0,
      candleCount: candles.length,
      checksum,
      includes: { candles: true, ticker: false, orderbook: false, trades: false },
    };

    await mkdir(config.outputPath, { recursive: true });
    await writeJsonlDataset(config.outputPath, metadata, candles);

    return { metadata, path: config.outputPath };
  }
}
