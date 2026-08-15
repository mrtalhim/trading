import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { JsonlLoader, ReplayLoader } from '../packages/datasets/dist/index.js';
import { loadDecisions } from '../apps/backtest/dist/index.js';
import { sweepConfigs } from '../apps/benchmark/dist/sweep.js';
import {
  randomDirectionStream,
  maCrossoverStream,
  runFixedBacktest,
} from '../apps/benchmark/dist/baseline.js';

const SLICE_DIR = process.argv[2] ?? 'datasets/realistic/slices/ethidr2026';
const SYMBOL = process.argv[3] ?? 'ETH/IDR';
const INITIAL_QUOTE = process.argv[4] !== undefined ? Number(process.argv[4]) : 10_000_000;
const MIN_VOLUME = process.argv[5] !== undefined ? Number(process.argv[5]) : 0.2;
const FEE_RATE = process.argv[6] !== undefined ? Number(process.argv[6]) : 0.003;
const SEEDS = process.argv[7] !== undefined ? Number(process.argv[7]) : 20;
const CONFIDENCE = process.argv[8] !== undefined ? Number(process.argv[8]) : 0.9;
const MA_PERIOD = process.argv[9] !== undefined ? Number(process.argv[9]) : 20;

const OUT = join(SLICE_DIR, 'directional-baseline-report.md');
const COMBINED = join(dirname(SLICE_DIR), 'directional-baseline-summary.md');
const SLICES_ROOT = dirname(SLICE_DIR);

const MIN_TRADES = 3;

const GRID = {
  symbol: SYMBOL,
  initialQuote: INITIAL_QUOTE,
  minVolume: MIN_VOLUME,
  feeRate: FEE_RATE,
  minConfidences: [0.5, 0.6, 0.7, 0.8, 0.9],
  fractions: [0.1],
  stopMultipliers: [1, 2, 3],
  tpMultipliers: [2, 3],
};

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function minMax(values) {
  return { min: Math.min(...values), max: Math.max(...values) };
}

function pctRank(real, nulls) {
  const atOrBelow = nulls.filter((n) => n <= real).length;
  return { rank: atOrBelow, pct: (atOrBelow / nulls.length) * 100 };
}

function classify(real, nulls) {
  const { pct } = pctRank(real, nulls);
  if (pct > 90) return 'above random tail (credible)';
  if (pct >= 75) return 'upper half, not clearly in tail';
  if (pct > 25) return 'middle of noise distribution';
  return 'at or below random';
}

async function loadAllCandles(dataset) {
  const replay = new ReplayLoader(dataset);
  return [...(await replay.all())].sort((a, b) => a.timestamp - b.timestamp);
}

async function runUnit(dir, files, decisions, fileName, match) {
  const [, slice, model] = match;
  if (decisions.length === 0) return null;

  const timestamps = decisions.map((d) => d.timestamp);
  const holdProb = decisions.filter((d) => d.action === 'hold').length / decisions.length;
  const dataset = new JsonlLoader(files.includes(slice) ? join(SLICE_DIR, slice) : SLICE_DIR);

  const { rows } = await sweepConfigs(dataset, decisions, GRID);
  const stopsOn = rows.filter((r) => r.enableStops && r.trades >= MIN_TRADES);
  if (stopsOn.length === 0) {
    console.log(`skip ${slice}/${model}: no stops-on config with >= ${MIN_TRADES} trades`);
    return null;
  }
  const bestStops = stopsOn.reduce((a, r) => (r.realizedPnl > a.realizedPnl ? r : a));

  const fixed = {
    symbol: SYMBOL,
    base: SYMBOL.split('/')[0],
    quote: SYMBOL.split('/')[1],
    initialQuote: INITIAL_QUOTE,
    feeRate: FEE_RATE,
    fraction: bestStops.fraction,
    minConfidence: bestStops.minConfidence,
    minVolume: MIN_VOLUME,
    atrStopMultiplier: bestStops.atrStopMultiplier,
    atrTpMultiplier: bestStops.atrTpMultiplier,
    enableStops: true,
  };

  const real = {
    realizedPnl: bestStops.realizedPnl,
    winRate: bestStops.winRate,
    trades: bestStops.trades,
  };

  const nullRows = [];
  for (let seed = 1; seed <= SEEDS; seed++) {
    const stream = randomDirectionStream(timestamps, { seed, holdProb, confidence: CONFIDENCE });
    const out = await runFixedBacktest(dataset, stream, fixed);
    nullRows.push({ seed, ...out });
  }

  const candles = await loadAllCandles(dataset);
  const maStream = maCrossoverStream(timestamps, candles, { period: MA_PERIOD, confidence: CONFIDENCE });
  const baselineB = await runFixedBacktest(dataset, maStream, fixed);

  const pnlNull = nullRows.map((r) => r.realizedPnl);
  const wrNull = nullRows.map((r) => r.winRate);
  const pnlRank = pctRank(real.realizedPnl, pnlNull);
  const wrRank = pctRank(real.winRate, wrNull);
  const beatsB = real.realizedPnl > baselineB.realizedPnl && real.winRate > baselineB.winRate;

  const verdict = classify(real.realizedPnl, pnlNull) === 'above random tail (credible)'
    ? beatsB
      ? 'clears both baselines'
      : 'beats random, not the free MA rule'
    : 'not distinguishable from noise';

  return { slice, model, holdProb, bestStops, real, nullRows, baselineB, pnlRank, wrRank, beatsB, verdict };
}

async function main() {
  const files = await readdir(SLICE_DIR);
  const decisionFiles = files.filter((f) => f.startsWith('decisions-') && f.endsWith('.jsonl')).sort();

  const units = [];
  for (const f of decisionFiles) {
    const match = f.match(/^decisions-(.*)-([a-z0-9_]+)\.jsonl$/);
    if (!match) continue;
    const decisions = await loadDecisions(join(SLICE_DIR, f));
    const unit = await runUnit(SLICE_DIR, files, decisions, f, match);
    if (unit) units.push(unit);
    console.log(`done ${unit ? `${unit.slice}/${unit.model}` : f}`);
  }

  if (units.length === 0) {
    console.log('no decision files to process');
    return;
  }

  const md = [];
  md.push(`# Directional baseline control report — ${SYMBOL} slices\n`);
  md.push(`Generated ${new Date().toISOString()}\n`);
  md.push(`Method: randomization test. For each slice the winning "best stops-on" risk config from the risk-regime sweep is held fixed; only the direction source changes — real LLM decisions vs **Baseline A** (seeded random direction, hold probability matched to the real model per slice, seeds 1–${SEEDS}) vs **Baseline B** (MA${MA_PERIOD} crossover, no randomness). The real model's PnL/win-rate percentile rank is taken within the ${SEEDS}-seed Baseline A null distribution. Same candles, same timestamps, same fees, same guardrails.\n`);
  md.push(`Setup: initialQuote ${INITIAL_QUOTE.toLocaleString('en-US')} IDR, feeRate ${FEE_RATE} per fill, minVolume ${MIN_VOLUME}, Baseline A fixed confidence ${CONFIDENCE}, MA period ${MA_PERIOD}.\n`);
  md.push('Reading: percentile rank > 90 → credible directional signal; middle of the distribution → not distinguishable from noise; below Baseline B → the LLM is not earning its cost over a free rule.\n');

  const cell = (n, digits = 0) => (Number.isFinite(n) ? n.toFixed(digits) : '—');

  for (const u of units) {
    const { bestStops } = u;
    md.push(`## ${u.slice} · ${u.model}\n`);
    md.push(`Winning stops-on config (from risk-regime sweep, held fixed): minConf ${bestStops.minConfidence}, fraction ${bestStops.fraction}, stopMult ${bestStops.atrStopMultiplier}, tpMult ${bestStops.atrTpMultiplier}.\n`);
    md.push(`Baseline A hold probability: ${(u.holdProb * 100).toFixed(0)}% (matched to the real model's observed holds).\n`);
    md.push('| direction source | pnl | winRate | trades |');
    md.push('| --- | --- | --- | --- |');
    md.push(`| real LLM (${u.model}) | ${cell(u.real.realizedPnl)} | ${u.real.winRate.toFixed(3)} | ${u.real.trades} |`);
    md.push(`| Baseline B (MA${MA_PERIOD}) | ${cell(u.baselineB.realizedPnl)} | ${u.baselineB.winRate.toFixed(3)} | ${u.baselineB.trades} |`);
    md.push(`| Baseline A median (${SEEDS} seeds) | ${cell(median(u.nullRows.map((r) => r.realizedPnl)))} | ${median(u.nullRows.map((r) => r.winRate)).toFixed(3)} | ${median(u.nullRows.map((r) => r.trades))} |`);
    const pnlMM = minMax(u.nullRows.map((r) => r.realizedPnl));
    const wrMM = minMax(u.nullRows.map((r) => r.winRate));
    md.push(`| Baseline A range | ${cell(pnlMM.min)}…${cell(pnlMM.max)} | ${wrMM.min.toFixed(3)}…${wrMM.max.toFixed(3)} | — |`);
    md.push('');
    md.push(`Percentile rank of real LLM within Baseline A null: **pnl ${u.pnlRank.rank}/${SEEDS} (${u.pnlRank.pct.toFixed(0)}%)**, winRate ${u.wrRank.rank}/${SEEDS} (${u.wrRank.pct.toFixed(0)}%).`);
    md.push(`Beats Baseline B on both PnL and win-rate: **${u.beatsB ? 'yes' : 'no'}**.`);
    md.push(`**Verdict: ${u.verdict}.**\n`);
    md.push('Baseline A per-seed detail:');
    md.push('| seed | pnl | winRate | trades |');
    md.push('| --- | --- | --- | --- |');
    for (const r of u.nullRows) {
      md.push(`| ${r.seed} | ${cell(r.realizedPnl)} | ${r.winRate.toFixed(3)} | ${r.trades} |`);
    }
    md.push('');
  }

  const clearedBoth = units.filter((u) => u.verdict === 'clears both baselines').length;
  const beatsB = units.filter((u) => u.beatsB).length;
  const credible = units.filter((u) => u.pnlRank.pct > 90).length;

  md.push('## Summary\n');
  md.push(`| slice | model | real pnl | real wr | B pnl | B wr | null median | pnl pct | wr pct | verdict |`);
  md.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const u of units) {
    md.push(
      `| ${u.slice} | ${u.model} | ${cell(u.real.realizedPnl)} | ${u.real.winRate.toFixed(3)} | ${cell(u.baselineB.realizedPnl)} | ${u.baselineB.winRate.toFixed(3)} | ${cell(median(u.nullRows.map((r) => r.realizedPnl)))} | ${u.pnlRank.pct.toFixed(0)}% | ${u.wrRank.pct.toFixed(0)}% | ${u.verdict} |`,
    );
  }
  md.push('');
  md.push(`Cross-slice aggregate: ${units.length} units; ${credible}/${units.length} in the random tail on PnL; ${clearedBoth}/${units.length} clear both baselines (PnL and win-rate); ${beatsB}/${units.length} beat Baseline B on both metrics.\n`);

  md.push('## Caveats\n');
  md.push('- **Config-selection bias favors the LLM.** The winning stops-on config was chosen to maximize the real model\'s PnL on this slice; the baselines run a config not tuned for them. A failure to clear the tail is therefore decisive; a positive result is suggestive only.');
  md.push('- **Small trade counts and one regime.** Stops-on configs trade tens of trades per slice over ~26-day windows; the 20-seed null is coarse (90th percentile ≈ rank 18/20). Four months of correlated IDR data is one market regime, not a robustness guarantee across bull/chop/drawdown.');
  md.push('- **Fee sensitivity.** At 0.6% round trip, configs that trade more often are the most fee-exposed (Baseline B trades at every non-warmup decision).');

  await writeFile(OUT, md.join('\n') + '\n');
  console.log(`report → ${OUT}`);

  await rebuildCombined();
}

async function rebuildCombined() {
  const rootFiles = await readdir(SLICES_ROOT);
  const reports = [];
  for (const f of rootFiles.sort()) {
    const reportPath = join(SLICES_ROOT, f, 'directional-baseline-report.md');
    try {
      reports.push({ dir: f, raw: await readFile(reportPath, 'utf-8') });
    } catch {
      // no report for this dir
    }
  }
  if (reports.length === 0) return;

  const md = [];
  md.push('# Directional baseline control — combined summary\n');
  md.push(`Generated ${new Date().toISOString()}\n`);
  md.push('Per-unit detail lives in each slice dir\'s `directional-baseline-report.md`.\n');
  md.push(`| asset | slice | model | real pnl | real wr | B pnl | B wr | null median | pnl pct | wr pct | verdict |`);
  md.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const r of reports) {
    const lines = r.raw.split('\n');
    const start = lines.findIndex((l) => l.startsWith('| slice | model |'));
    const end = lines.findIndex((l, i) => i > start && l.trim() === '');
    if (start === -1) continue;
    let rows = lines.slice(start + 1, end);
    if (rows[0]?.startsWith('| ---')) rows = rows.slice(1);
    for (const l of rows) {
      md.push(`| ${r.dir}${l}`);
    }
  }
  md.push('');
  await writeFile(COMBINED, md.join('\n') + '\n');
  console.log(`combined summary → ${COMBINED}`);
}

main().catch((err) => {
  process.stderr.write(`${err.stack}\n`);
  process.exit(1);
});
