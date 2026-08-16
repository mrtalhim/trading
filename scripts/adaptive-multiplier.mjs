// Regime-adaptive ATR multiplier — pre-registered comparison run
// (docs/experiments/adaptive-atr-multiplier.md). For each unit (slice × model)
// the control is the per-slice best stops-on fixed config from the risk-regime
// sweep; the treatment is the same decisions/sizing/guardrails with
// `riskParameterMode: 'adaptive'` — only stop/TP multiplier selection differs.
// Emits a per-unit table + local paired bootstrap to
// `datasets/realistic/slices/…/adaptive-multiplier-report.md` and aggregates a
// combined summary with the overall 10,000-resample paired bootstrap + sign test
// and the pre-committed verdict.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { JsonlLoader } from '../packages/datasets/dist/index.js';
import { loadDecisions, BacktestEngine } from '../apps/backtest/dist/index.js';
import { sweepConfigs } from '../apps/benchmark/dist/sweep.js';
import { computeWinRate, computeMaxDrawdown } from '../apps/benchmark/dist/score.js';

const SLICE_DIR = process.argv[2] ?? 'datasets/realistic/slices/ethidr2026';
const SYMBOL = process.argv[3] ?? 'ETH/IDR';
const INITIAL_QUOTE = process.argv[4] !== undefined ? Number(process.argv[4]) : 10_000_000;
const MIN_VOLUME = process.argv[5] !== undefined ? Number(process.argv[5]) : 0.2;
const FEE_RATE = process.argv[6] !== undefined ? Number(process.argv[6]) : 0.003;
const BOOTSTRAP_SAMPLES = process.argv[7] !== undefined ? Number(process.argv[7]) : 10_000;
const BOOTSTRAP_SEED = process.argv[8] !== undefined ? Number(process.argv[8]) : 20260815;

const OUT = join(SLICE_DIR, 'adaptive-multiplier-report.md');
const COMBINED = join(dirname(SLICE_DIR), 'adaptive-multiplier-summary.md');
const SLICES_ROOT = dirname(SLICE_DIR);

const MIN_TRADES = 3;
const ADOPT_WINS = 20; // pre-committed: ≥ 20/32 units for adoption

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

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const frac = idx - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

function pairedBootstrap(deltas, samples, seed) {
  if (deltas.length === 0) return { mean: 0, ci95: [0, 0] };
  const rand = mulberry32(seed);
  const boot = [];
  for (let b = 0; b < samples; b++) {
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

function verdict(boot, wins, total) {
  const ciPositive = boot.ci95[0] > 0;
  const ciNegative = boot.ci95[1] < 0;
  const adopted = ciPositive && wins >= ADOPT_WINS;
  if (adopted) {
    return `ADOPT (CI excludes zero on the positive side and adaptive beats control on ${wins}/${total} units, ≥ ${ADOPT_WINS} required)`;
  }
  if (ciNegative || !ciPositive) {
    return `NOT ADOPTED (decisive null: CI includes zero or is negative; adaptive beats control on ${wins}/${total})`;
  }
  return `NOT ADOPTED (CI positive but adaptive beats control on only ${wins}/${total} units, < ${ADOPT_WINS} required)`;
}

async function runAdaptive(dataset, decisions, bestStops) {
  const result = await new BacktestEngine({
    dataset,
    decisions,
    symbol: SYMBOL,
    base: SYMBOL.split('/')[0],
    quote: SYMBOL.split('/')[1],
    initialQuote: INITIAL_QUOTE,
    feeRate: FEE_RATE,
    sizing: { fraction: bestStops.fraction },
    atrStopMultiplier: bestStops.atrStopMultiplier,
    atrTpMultiplier: bestStops.atrTpMultiplier,
    enableStops: true,
    riskParameterMode: 'adaptive',
    guardrails: { minConfidence: bestStops.minConfidence, minVolume: MIN_VOLUME },
    collectEquity: true,
  }).run();
  const closed = result.trades.filter((t) => t.realizedPnl !== 0);
  return {
    realizedPnl: result.realizedPnl,
    winRate: computeWinRate(result.trades),
    maxDrawdown: computeMaxDrawdown(result.equityCurve ?? []),
    closedTrades: closed.length,
    trades: result.tradeCount,
    states: result.adaptiveStates ?? { expanding: 0, neutral: 0, contracting: 0 },
  };
}

async function runUnit(files, decisions, fileName, match) {
  const [, slice, model] = match;
  if (decisions.length === 0) return null;

  const dataset = new JsonlLoader(files.includes(slice) ? join(SLICE_DIR, slice) : SLICE_DIR);
  const { rows } = await sweepConfigs(dataset, decisions, GRID);
  const stopsOn = rows.filter((r) => r.enableStops && r.trades >= MIN_TRADES);
  if (stopsOn.length === 0) {
    console.log(`skip ${slice}/${model}: no stops-on config with >= ${MIN_TRADES} trades`);
    return null;
  }
  const bestStops = stopsOn.reduce((a, r) => (r.realizedPnl > a.realizedPnl ? r : a));
  const adaptive = await runAdaptive(dataset, decisions, bestStops);

  if (bestStops.closedTrades < MIN_TRADES || adaptive.closedTrades < MIN_TRADES) {
    console.log(`drop ${slice}/${model}: closed trades control=${bestStops.closedTrades} adaptive=${adaptive.closedTrades}`);
    return { slice, model, dropped: true, controlClosed: bestStops.closedTrades, adaptiveClosed: adaptive.closedTrades };
  }

  const control = {
    realizedPnl: bestStops.realizedPnl,
    winRate: bestStops.winRate,
    maxDrawdown: bestStops.maxDrawdown,
    closedTrades: bestStops.closedTrades,
    trades: bestStops.trades,
    config: {
      minConfidence: bestStops.minConfidence,
      fraction: bestStops.fraction,
      atrStopMultiplier: bestStops.atrStopMultiplier,
      atrTpMultiplier: bestStops.atrTpMultiplier,
    },
  };

  return {
    slice,
    model,
    dropped: false,
    control,
    adaptive,
    delta: adaptive.realizedPnl - control.realizedPnl,
  };
}

function cell(n, digits = 0) {
  return Number.isFinite(n) ? n.toFixed(digits) : '—';
}

async function main() {
  const files = await readdir(SLICE_DIR);
  const decisionFiles = files.filter((f) => f.startsWith('decisions-') && f.endsWith('.jsonl')).sort();

  const units = [];
  for (const f of decisionFiles) {
    const match = f.match(/^decisions-(.*)-([a-z0-9_]+)\.jsonl$/);
    if (!match) continue;
    const decisions = await loadDecisions(join(SLICE_DIR, f));
    const unit = await runUnit(files, decisions, f, match);
    if (unit) {
      units.push(unit);
      console.log(`done ${unit.slice}/${unit.model}${unit.dropped ? ' (dropped)' : ''}`);
    } else {
      console.log(`done ${f} (skipped)`);
    }
  }

  if (units.length === 0) {
    console.log('no decision files to process');
    return;
  }

  const kept = units.filter((u) => !u.dropped);
  const md = [];
  md.push(`# Adaptive ATR multiplier report — ${SLICE_DIR}\n`);
  md.push(`Generated ${new Date().toISOString()}\n`);
  md.push('Pre-registered analysis `docs/experiments/adaptive-atr-multiplier.md`. Control = per-slice best stops-on fixed config from the risk-regime sweep (oracle, in-sample). Treatment = same decisions/sizing/guardrails with the pre-committed regime-adaptive rule (window 96, thresholds 0.75/0.25, multipliers grid {1,2,3}×{2,3} → expanding 3/3, neutral 2/3, contracting 1/2). Only stop/TP multiplier selection differs between arms.\n');
  md.push(`Setup: initialQuote ${INITIAL_QUOTE.toLocaleString('en-US')} IDR, feeRate ${FEE_RATE} per fill, minVolume ${MIN_VOLUME}, sweep grid minConfidences [0.5…0.9] × fraction 0.1.\n`);
  md.push(`Units processed: ${units.length} (${kept.length} kept for analysis, ${units.length - kept.length} dropped for < ${MIN_TRADES} closing trades in an arm).\n`);

  md.push('| unit | model | ctrl pnl | adap pnl | delta | ctrl wr | adap wr | ctrl dd | adap dd | ctrl tr | adap tr | ctrl closed | adap closed | expanding | neutral | contracting |');
  md.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const u of units) {
    if (u.dropped) {
      md.push(`| ${u.slice} | ${u.model} | — | — | — | — | — | — | — | — | — | ${u.controlClosed} | ${u.adaptiveClosed} | — | — | — |`);
      continue;
    }
    const { control, adaptive } = u;
    md.push(
      `| ${u.slice} | ${u.model} | ${cell(control.realizedPnl)} | ${cell(adaptive.realizedPnl)} | ${cell(u.delta)} | ${control.winRate.toFixed(3)} | ${adaptive.winRate.toFixed(3)} | ${cell(control.maxDrawdown, 0)} | ${cell(adaptive.maxDrawdown, 0)} | ${control.trades} | ${adaptive.trades} | ${control.closedTrades} | ${adaptive.closedTrades} | ${adaptive.states.expanding} | ${adaptive.states.neutral} | ${adaptive.states.contracting} |`,
    );
  }
  md.push('');

  const deltas = kept.map((u) => u.delta);
  if (deltas.length > 0) {
    const boot = pairedBootstrap(deltas, BOOTSTRAP_SAMPLES, BOOTSTRAP_SEED);
    const wins = kept.filter((u) => u.delta > 0).length;
    const totals = {
      controlPnl: kept.reduce((a, u) => a + u.control.realizedPnl, 0),
      adaptivePnl: kept.reduce((a, u) => a + u.adaptive.realizedPnl, 0),
    };
    md.push('## Local paired bootstrap (per slice dir)\n');
    md.push(`Paired deltas (adaptive − control) over ${kept.length} units, ${BOOTSTRAP_SAMPLES} resamples, seed ${BOOTSTRAP_SEED}.\n`);
    md.push(`| statistic | value |`);
    md.push(`| --- | --- |`);
    md.push(`| mean paired delta | ${cell(boot.mean)} |`);
    md.push(`| 95% CI | ${cell(boot.ci95[0])} … ${cell(boot.ci95[1])} |`);
    md.push(`| units where adaptive > control | ${wins}/${kept.length} |`);
    md.push(`| sum control PnL | ${cell(totals.controlPnl)} |`);
    md.push(`| sum adaptive PnL | ${cell(totals.adaptivePnl)} |`);
    md.push('');
  }

  await writeFile(OUT, md.join('\n') + '\n');
  console.log(`report → ${OUT}`);

  await rebuildCombined();
}

async function rebuildCombined() {
  const rootFiles = await readdir(SLICES_ROOT);
  const reports = [];
  for (const f of rootFiles.sort()) {
    const reportPath = join(SLICES_ROOT, f, 'adaptive-multiplier-report.md');
    try {
      reports.push({ dir: f, raw: await readFile(reportPath, 'utf-8') });
    } catch {
      // no report for this dir
    }
  }
  if (reports.length === 0) return;

  const rows = [];
  for (const r of reports) {
    for (const line of r.raw.split('\n')) {
      const m = line.match(/^\| (w[0-9]+) \| ([a-z0-9_]+) \| (-?\d+\.?\d*) \| (-?\d+\.?\d*) \| (-?\d+\.?\d*) \| /);
      if (!m) continue;
      rows.push({
        asset: r.dir,
        unit: m[1],
        model: m[2],
        controlPnl: Number(m[3]),
        adaptivePnl: Number(m[4]),
        delta: Number(m[5]),
      });
    }
  }
  rows.sort((a, b) => `${a.asset}/${a.unit}/${a.model}`.localeCompare(`${b.asset}/${b.unit}/${b.model}`));

  const md = [];
  md.push('# Adaptive ATR multiplier — combined summary\n');
  md.push(`Generated ${new Date().toISOString()}\n`);
  md.push('Per-unit detail lives in each slice dir\'s `adaptive-multiplier-report.md`. This summary is the pre-committed reading of the whole 32-unit corpus (control = per-slice oracle, treatment = single adaptive rule).\n');

  md.push(`| asset | unit | model | ctrl pnl | adap pnl | delta |`);
  md.push('| --- | --- | --- | --- | --- | --- |');
  for (const r of rows) {
    md.push(`| ${r.asset} | ${r.unit} | ${r.model} | ${cell(r.controlPnl)} | ${cell(r.adaptivePnl)} | ${cell(r.delta)} |`);
  }
  md.push('');

  if (rows.length > 0) {
    const deltas = rows.map((r) => r.delta);
    const boot = pairedBootstrap(deltas, BOOTSTRAP_SAMPLES, BOOTSTRAP_SEED);
    const wins = rows.filter((r) => r.delta > 0).length;
    md.push('## Paired bootstrap over units\n');
    md.push(`Paired deltas (adaptive − control), ${BOOTSTRAP_SAMPLES} resamples, seed ${BOOTSTRAP_SEED}.\n`);
    md.push('| statistic | value |');
    md.push('| --- | --- |');
    md.push(`| units | ${rows.length} |`);
    md.push(`| mean paired delta | ${cell(boot.mean)} |`);
    md.push(`| 95% CI | ${cell(boot.ci95[0])} … ${cell(boot.ci95[1])} |`);
    md.push(`| units where adaptive > control | ${wins}/${rows.length} |`);
    md.push(`| sign-test lower bound (≥ ${ADOPT_WINS} required) | ${wins >= ADOPT_WINS ? 'met' : 'not met'} |`);
    md.push('');
    md.push(`## Verdict\n`);
    md.push(`**${verdict(boot, wins, rows.length)}.**\n`);
  }

  md.push('## Caveats\n');
  md.push('- Control has the oracle advantage (per-slice in-sample best); a CI-includes-zero is therefore a decisive null, a positive is suggestive only.');
  md.push('- 32 units are two regimes of correlated IDR data with tens of closing trades per unit; bootstrap CIs, not point estimates, are the reading.');
  md.push('- Applies to this exact pre-committed rule (window 96, thresholds 0.75/0.25, grid {1,2,3}×{2,3}); no re-running with tweaked parameters.');

  await writeFile(COMBINED, md.join('\n') + '\n');
  console.log(`combined summary → ${COMBINED}`);
}

main().catch((err) => {
  process.stderr.write(`${err.stack}\n`);
  process.exit(1);
});
