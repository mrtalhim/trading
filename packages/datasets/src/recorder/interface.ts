import type { DatasetMetadata } from '../interfaces.js';

export interface RecordingConfig {
  exchange: string;
  pair: string;
  interval: string;
  outputPath: string;
}

export interface DatasetRecorder {
  start(config: RecordingConfig): Promise<void>;
  stop(): Promise<{ metadata: DatasetMetadata; path: string }>;
}
