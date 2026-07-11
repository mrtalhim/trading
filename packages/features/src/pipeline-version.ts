import type { Candle } from '@trading/core';
import { pipelineVersion } from '@trading/indicators';
import { registry } from './registry.js';
import type { FeatureSpec } from './types.js';

export function featurePipelineVersion(specs: FeatureSpec[], candles: Candle[]): string {
  const parts = specs.map((spec) => {
    const sub = registry[spec.indicator](candles, spec.params).metadata.pipelineVersion;
    return `${spec.name}|${spec.indicator}|${JSON.stringify(spec.params ?? {})}|${sub}`;
  });
  return pipelineVersion('feature-pipeline', { specs: parts });
}
