import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Candle } from '@trading/core';
import type { Dataset, DatasetMetadata } from '@trading/datasets';
import { registry } from './registry.js';
import { featurePipelineVersion } from './pipeline-version.js';
import type { FeatureMetadata, FeatureRow, FeatureSpec } from './types.js';

const indicatorEnum = z.enum(['rsi', 'atr', 'adx', 'ema', 'sma', 'vwap', 'return', 'logReturn']);

const specSchema = z.object({
  name: z.string().min(1),
  indicator: indicatorEnum,
  params: z.record(z.unknown()).optional(),
});

const configSchema = z.array(specSchema).min(1);

export function validateFeatureConfig(input: unknown): FeatureSpec[] {
  const parsed = configSchema.parse(input) as FeatureSpec[];
  const seen = new Set<string>();
  for (const spec of parsed) {
    if (seen.has(spec.name)) {
      throw new Error(`duplicate feature name: ${spec.name}`);
    }
    seen.add(spec.name);
  }
  return parsed;
}

function computeFeatureChecksum(rows: FeatureRow[]): string {
  const matrix = rows.map((r) =>
    Object.values(r.features).map((v) => (Number.isNaN(v) ? null : v)),
  );
  return createHash('sha256').update(JSON.stringify(matrix)).digest('hex').slice(0, 16);
}

export class FeaturePipeline {
  private readonly dataset: Dataset;
  private readonly specs: FeatureSpec[];
  private _candles: Candle[] | undefined;
  private _rows: FeatureRow[] | undefined;
  private _metadata: FeatureMetadata | undefined;

  constructor(dataset: Dataset, specs: unknown) {
    this.specs = validateFeatureConfig(specs);
    this.dataset = dataset;
  }

  async metadata(): Promise<FeatureMetadata> {
    await this.build();
    return this._metadata!;
  }

  async *rows(): AsyncIterable<FeatureRow> {
    await this.build();
    for (const row of this._rows!) {
      yield row;
    }
  }

  private async loadCandles(): Promise<Candle[]> {
    const out: Candle[] = [];
    for await (const candle of this.dataset.candles()) {
      out.push(candle);
    }
    return out;
  }

  private async build(): Promise<void> {
    if (this._rows) return;
    const candles = (this._candles ??= await this.loadCandles());
    const rows: FeatureRow[] = [];

    for (let i = 0; i < candles.length; i++) {
      const window = candles.slice(0, i + 1);
      const features: Record<string, number> = {};
      const insufficient: string[] = [];
      for (const spec of this.specs) {
        const result = registry[spec.indicator](window, spec.params);
        features[spec.name] = result.value;
        if (Number.isNaN(result.value)) {
          insufficient.push(spec.name);
        }
      }
      rows.push({
        index: i,
        candle: candles[i],
        features,
        insufficient,
        metadata: { candlesConsumed: i + 1 },
      });
    }

    const version = featurePipelineVersion(this.specs, candles);
    const source: DatasetMetadata = await this.dataset.metadata();
    const checksum = computeFeatureChecksum(rows);

    this._metadata = {
      pipelineVersion: version,
      source,
      features: this.specs,
      candleCount: candles.length,
      start: candles.length ? candles[0].timestamp : 0,
      end: candles.length ? candles[candles.length - 1].timestamp : 0,
      checksum,
    };
    this._rows = rows;
  }
}
