import type { Candle } from '@trading/core';
import type { Dataset, DatasetMetadata } from '@trading/datasets';
import { scoreProbes } from './score.js';
import type { ProbeResult } from './probe.js';

export interface BlockAnalysisOptions {
  blockSize: number;
  symbol: string;
  initialQuote: number;
  feeRate: number;
  fraction: number;
  atrStopMultiplier: number;
  bootstrapSamples: number;
  seed: number;
}

export interface BlockDelta {
  block: number;
  matchedSamples: number;
  controlPnl: number;
  treatmentPnl: number;
  pnlDelta: number;
  controlWinRate: number;
  treatmentWinRate: number;
  winRateDelta: number;
  controlMaxDd: number;
  treatmentMaxDd: number;
  maxDdDelta: number;
  changedDecisions: number;
}

export interface DirectionalAccuracy {
  controlCorrect: number;
  controlTotal: number;
  treatmentCorrect: number;
  treatmentTotal: number;
}

export interface McNemarResult {
  treatmentWins: number;
  controlWins: number;
  pValueTwoSided: number;
}

export interface PairedAnalysisResult {
  blockSize: number;
  sampleSizePerArm: number;
  matchedSamples: number;
  deltas: BlockDelta[];
  pnlDeltaMean: number;
  pnlDeltaCI95: [number, number];
  winRateDeltaMean: number;
  winRateDeltaCI95: [number, number];
  maxDdDeltaMean: number;
  maxDdDeltaCI95: [number, number];
  directional: DirectionalAccuracy;
  directionalMcNemar: McNemarResult;
}

const DEFAULT_OPTIONS: BlockAnalysisOptions = {
  blockSize: 100,
  symbol: 'BTC/USDT',
  initialQuote: 10000,
  feeRate: 0,
  fraction: 0.1,
  atrStopMultiplier: 2,
  bootstrapSamples: 1000,
  seed: 20260807,
};

class CandleSliceDataset implements Dataset {
  constructor(
    private readonly data: Candle[],
    private readonly meta: DatasetMetadata,
  ) {}

  async metadata(): Promise<DatasetMetadata> {
    return this.meta;
  }

  async *candles(): AsyncIterable<Candle> {
    for (const c of this.data) yield c;
  }
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const frac = idx - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

function bootstrapCI(
  deltas: number[],
  opts: BlockAnalysisOptions,
): { mean: number; ci95: [number, number] } {
  if (deltas.length === 0) return { mean: 0, ci95: [0, 0] };
  const rand = mulberry32(opts.seed);
  const boot: number[] = [];
  for (let b = 0; b < opts.bootstrapSamples; b++) {
    let sum = 0;
    for (let i = 0; i < deltas.length; i++) {
      sum += deltas[Math.floor(rand() * deltas.length)];
    }
    boot.push(sum / deltas.length);
  }
  boot.sort((a, b) => a - b);
  const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  return { mean, ci95: [percentile(boot, 0.025), percentile(boot, 0.975)] };
}

function exactMcNemar(treatmentWins: number, controlWins: number): McNemarResult {
  const n = treatmentWins + controlWins;
  if (n === 0) {
    return { treatmentWins, controlWins, pValueTwoSided: 1 };
  }
  const k = Math.min(treatmentWins, controlWins);
  let cumulative = 0;
  let comb = 1;
  for (let i = 0; i <= k; i++) {
    if (i > 0) comb = (comb * (n - i + 1)) / i;
    cumulative += comb;
  }
  let pLow = cumulative / Math.pow(2, n);
  if (pLow > 0.5) pLow = 1 - pLow;
  return {
    treatmentWins,
    controlWins,
    pValueTwoSided: Math.min(1, 2 * pLow),
  };
}

function directional(a: 'long' | 'short', nextClose: number, thisClose: number): boolean {
  return a === 'long' ? nextClose > thisClose : nextClose < thisClose;
}

export async function forPairedBlocks(
  dataset: Dataset,
  controlProbes: ProbeResult[],
  treatmentProbes: ProbeResult[],
  partialOptions?: Partial<BlockAnalysisOptions>,
): Promise<PairedAnalysisResult> {
  const opts = { ...DEFAULT_OPTIONS, ...partialOptions };
  const meta = await dataset.metadata();

  const allCandles: Candle[] = [];
  for await (const c of dataset.candles()) allCandles.push(c);
  allCandles.sort((a, b) => a.timestamp - b.timestamp);
  const candleIndex = new Map<number, number>(allCandles.map((c, i) => [c.timestamp, i]));

  const controlByTs = new Map<number, ProbeResult>(controlProbes.map((p) => [p.timestamp, p]));
  const treatmentByTs = new Map<number, ProbeResult>(treatmentProbes.map((p) => [p.timestamp, p]));
  const timestamps = [...new Set([...controlByTs.keys(), ...treatmentByTs.keys()])].sort(
    (a, b) => a - b,
  );

  const blockSize = Math.max(1, opts.blockSize);
  const nBlocks = Math.max(1, Math.ceil(timestamps.length / blockSize));
  const deltas: BlockDelta[] = [];

  const baseScoreOpts = {
    symbol: opts.symbol,
    initialQuote: opts.initialQuote,
    feeRate: opts.feeRate,
    fraction: opts.fraction,
    atrStopMultiplier: opts.atrStopMultiplier,
  };

  for (let block = 0; block < nBlocks; block++) {
    const blockTs = timestamps.slice(block * blockSize, (block + 1) * blockSize);
    const ctl = blockTs
      .map((ts) => controlByTs.get(ts))
      .filter((x): x is ProbeResult => x !== undefined);
    const trt = blockTs
      .map((ts) => treatmentByTs.get(ts))
      .filter((x): x is ProbeResult => x !== undefined);

    const firstIdx = candleIndex.get(blockTs[0]);
    const lastIdx = candleIndex.get(blockTs[blockTs.length - 1]);
    if (firstIdx === undefined || lastIdx === undefined) continue;

    const lead = Math.min(firstIdx, 40);
    const slice = allCandles.slice(Math.max(0, firstIdx - lead), lastIdx + 1);
    const blockDataset = new CandleSliceDataset(slice, meta);

    const scoreCtl = await scoreProbes(blockDataset, ctl, baseScoreOpts);
    const scoreTrt = await scoreProbes(blockDataset, trt, baseScoreOpts);

    const changedDecisions = blockTs.filter((ts) => {
      const a = controlByTs.get(ts)?.action;
      const b = treatmentByTs.get(ts)?.action;
      return a !== undefined && b !== undefined && a !== b;
    }).length;

    deltas.push({
      block,
      matchedSamples: blockTs.length,
      controlPnl: scoreCtl.backtest.realizedPnl,
      treatmentPnl: scoreTrt.backtest.realizedPnl,
      pnlDelta: scoreTrt.backtest.realizedPnl - scoreCtl.backtest.realizedPnl,
      controlWinRate: scoreCtl.winRate,
      treatmentWinRate: scoreTrt.winRate,
      winRateDelta: scoreTrt.winRate - scoreCtl.winRate,
      controlMaxDd: scoreCtl.maxDrawdown,
      treatmentMaxDd: scoreTrt.maxDrawdown,
      maxDdDelta: scoreTrt.maxDrawdown - scoreCtl.maxDrawdown,
      changedDecisions,
    });
  }

  const pnlCI = bootstrapCI(
    deltas.map((d) => d.pnlDelta),
    opts,
  );
  const wrCI = bootstrapCI(
    deltas.map((d) => d.winRateDelta),
    opts,
  );
  const ddCI = bootstrapCI(
    deltas.map((d) => d.maxDdDelta),
    opts,
  );

  let controlCorrect = 0;
  let controlTotal = 0;
  let treatmentCorrect = 0;
  let treatmentTotal = 0;
  let discordantTreatment = 0;
  let discordantControl = 0;

  for (const ts of timestamps) {
    const c = controlByTs.get(ts);
    const t = treatmentByTs.get(ts);
    if (!c || !t) continue;
    const idx = candleIndex.get(ts);
    if (idx === undefined) continue;
    const current = allCandles[idx];
    const next = allCandles[idx + 1];
    if (!next) continue;

    if (c.action && c.action !== 'hold') {
      controlTotal++;
      if (directional(c.action, next.close, current.close)) controlCorrect++;
    }
    if (t.action && t.action !== 'hold') {
      treatmentTotal++;
      if (directional(t.action, next.close, current.close)) treatmentCorrect++;
    }

    if (!c.action || !t.action || c.action === 'hold' || t.action === 'hold') continue;
    if (c.action === t.action) continue;
    const cOk = directional(c.action, next.close, current.close);
    const tOk = directional(t.action, next.close, current.close);
    if (cOk === tOk) continue;
    if (tOk) discordantTreatment++;
    else discordantControl++;
  }

  return {
    blockSize,
    sampleSizePerArm: timestamps.length,
    matchedSamples: timestamps.length,
    deltas,
    pnlDeltaMean: pnlCI.mean,
    pnlDeltaCI95: pnlCI.ci95,
    winRateDeltaMean: wrCI.mean,
    winRateDeltaCI95: wrCI.ci95,
    maxDdDeltaMean: ddCI.mean,
    maxDdDeltaCI95: ddCI.ci95,
    directional: { controlCorrect, controlTotal, treatmentCorrect, treatmentTotal },
    directionalMcNemar: exactMcNemar(discordantTreatment, discordantControl),
  };
}
