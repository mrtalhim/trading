import { createHash } from 'node:crypto';
import type { Candle } from '@trading/core';
import type {
  DetectorMap,
  DoublePatterns,
  PatternContext,
  PatternDetector,
  PatternOptions,
  SinglePatterns,
  TriplePatterns,
} from './pattern-types.js';
import { singleDetectors } from './pattern-single.js';
import { doubleDetectors } from './pattern-double.js';
import { tripleDetectors } from './pattern-triple.js';
import { detectStructural } from './pattern-structural.js';

const DEFAULT_OPTIONS: PatternOptions = {
  structureLookback: 12,
  proximityThreshold: 0.15,
  minStructureCandles: 5,
};

const STRUCTURAL_VERSION = '1.0.0';

export function normalizePatternOptions(opts?: PatternOptions): Required<PatternOptions> {
  return {
    structureLookback: opts?.structureLookback ?? DEFAULT_OPTIONS.structureLookback!,
    proximityThreshold: opts?.proximityThreshold ?? DEFAULT_OPTIONS.proximityThreshold!,
    minStructureCandles: opts?.minStructureCandles ?? DEFAULT_OPTIONS.minStructureCandles!,
  };
}

function detectorVersions(): Record<string, string> {
  const versions: Record<string, string> = {};
  const collect = (prefix: string, map: DetectorMap): void => {
    for (const [name, detector] of Object.entries(map)) {
      versions[`${prefix}.${name}`] = detector.version;
    }
  };
  collect('single', singleDetectors);
  collect('double', doubleDetectors);
  collect('triple', tripleDetectors);
  versions['structural'] = STRUCTURAL_VERSION;
  return versions;
}

/** 16-char hex hash over every detector version + active options. Changes when any detector logic version bumps. */
export function buildPatternVersion(opts?: PatternOptions): string {
  const normalized = normalizePatternOptions(opts);
  const serialized = JSON.stringify({ versions: detectorVersions(), opts: normalized });
  return createHash('sha256').update(serialized).digest('hex').slice(0, 16);
}

function runAll(map: DetectorMap, candles: Candle[], opts: Required<PatternOptions>): boolean[] {
  return Object.entries(map).map(([, detector]) =>
    (detector as PatternDetector).run(candles, opts),
  );
}

function toRecord(map: DetectorMap, values: boolean[]): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  Object.keys(map).forEach((name, index) => {
    out[name] = values[index];
  });
  return out;
}

export function detectPatternContext(candles: Candle[], opts?: PatternOptions): PatternContext {
  const normalized = normalizePatternOptions(opts);
  return {
    single: toRecord(
      singleDetectors,
      runAll(singleDetectors, candles, normalized),
    ) as unknown as SinglePatterns,
    double: toRecord(
      doubleDetectors,
      runAll(doubleDetectors, candles, normalized),
    ) as unknown as DoublePatterns,
    triple: toRecord(
      tripleDetectors,
      runAll(tripleDetectors, candles, normalized),
    ) as unknown as TriplePatterns,
    structural: detectStructural(candles, normalized),
    patternVersion: buildPatternVersion(opts),
  };
}
