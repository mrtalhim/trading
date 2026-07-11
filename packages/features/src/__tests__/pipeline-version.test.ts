import { describe, it, expect } from 'vitest';
import { pipelineVersion } from '@trading/indicators';
import { featurePipelineVersion } from '../pipeline-version.js';
import type { FeatureSpec } from '../types.js';
import { loadGoldenDataset } from './helpers.js';

const candles = loadGoldenDataset('btc_15m');

const base: FeatureSpec[] = [{ name: 'rsi_14', indicator: 'rsi', params: { period: 14 } }];

describe('featurePipelineVersion', () => {
  it('returns a 16-char hex string', () => {
    const v = featurePipelineVersion(base, candles);
    expect(v).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is deterministic for identical specs and candles', () => {
    expect(featurePipelineVersion(base, candles)).toBe(featurePipelineVersion(base, candles));
  });

  it('changes when an indicator parameter changes', () => {
    const changed: FeatureSpec[] = [{ name: 'rsi_14', indicator: 'rsi', params: { period: 21 } }];
    expect(featurePipelineVersion(changed, candles)).not.toBe(
      featurePipelineVersion(base, candles),
    );
  });

  it('changes when the indicator name changes', () => {
    const changed: FeatureSpec[] = [{ name: 'atr_14', indicator: 'atr', params: { period: 14 } }];
    expect(featurePipelineVersion(changed, candles)).not.toBe(
      featurePipelineVersion(base, candles),
    );
  });

  it('incorporates the underlying indicator pipelineVersion', () => {
    const sub = pipelineVersion('rsi', { period: 14 });
    const recomputed = pipelineVersion('feature-pipeline', {
      specs: [`rsi_14|rsi|${JSON.stringify({ period: 14 })}|${sub}`],
    });
    expect(featurePipelineVersion(base, candles)).toBe(recomputed);
  });
});
