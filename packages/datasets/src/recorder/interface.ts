import type { Candle } from '@trading/core';
import type { DatasetMetadata } from '../interfaces.js';

export interface RecordingConfig {
  exchange: string;
  pair: string;
  interval: string;
  outputPath: string;
}

/**
 * A source of candles to record. Implementations are injected into the
 * recorder so the recorder stays decoupled from any specific exchange client
 * (the real Indodax live adapter arrives in M9). For M6 it is typically driven
 * by a static historical dataset or the paper-exchange price feed.
 *
 * The `signal` is aborted when {@link DatasetRecorder.stop} is called; finite
 * sources can ignore it (they complete naturally) while long-running live
 * sources should stop producing on abort.
 */
export type CandleSource = (config: RecordingConfig, signal: AbortSignal) => AsyncIterable<Candle>;

export interface DatasetRecorder {
  start(config: RecordingConfig): Promise<void>;
  stop(): Promise<{ metadata: DatasetMetadata; path: string }>;
}
