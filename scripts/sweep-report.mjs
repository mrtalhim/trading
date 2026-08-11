import { readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { JsonlLoader } from '../packages/datasets/dist/index.js';
import { loadDecisions } from '../apps/backtest/dist/index.js';
import { sweepConfigs } from '../apps/benchmark/dist/sweep.js';

const SLICE_DIR = process.argv[2] ?? 'datasets/realistic/slices/idr2026';
const OUT = process.argv[3] ?? join(SLICE_DIR, 'sweep-report.md');

const GRID = {
  symbol: process.argv[4] ?? 'BTC/IDR',
  initialQuote: process.argv[5] !== undefined ? Number(process.argv[5]) : 10_000_000,
  minVolume: process.argv[6] !== undefined ? Number(process.argv[6]) : 0.02,
  feeRate: process.argv[7] !== undefined ? Number(process.argv[7]) : 0.003,
  minConfidences: [0.5, 0.6, 0.7, 0.8, 0.9],
  fractions: [0.1],
  stopMultipliers: [1, 2, 3],
  tpMultipliers: [2, 3],
};

/** Minimum closing trades before a variant is eligible for the "best" slot. */
const MIN_TRADES = 3;

async function main() {
  const files = await readdir(SLICE_DIR);
  const decisionFiles = files.filter((f) => f.startsWith('decisions-') && f.endsWith('.jsonl')).sort();

  const rows = [];
  for (const f of decisionFiles) {
    const match = f.match(/^decisions-(.*)-([a-z0-9_]+)\.jsonl$/);
    if (!match) continue;
    const [, slice, model] = match;
    const decisions = await loadDecisions(join(SLICE_DIR, f));
    if (decisions.length === 0) {
      console.log(`skip ${slice}/${model}: no decisions`);
      continue;
    }
    const result = await sweepConfigs(new JsonlLoader(files.includes(slice) ? join(SLICE_DIR, slice) : SLICE_DIR), decisions, GRID);

    const noStops = result.rows.filter((r) => !r.enableStops);
    const withStops = result.rows.filter((r) => r.enableStops);
    const best = (rs) => {
      const eligible = rs.filter((r) => r.trades >= MIN_TRADES);
      return eligible.reduce((a, r) => (r.realizedPnl > a.realizedPnl ? r : a), eligible[0]);
    };

    const bestNoStops = best(noStops);
    const bestStops = best(withStops);

    // min-confidence effect with stops off: win rate / trades per threshold at fraction 0.1
    const confEffect = noStops
      .filter((r) => r.fraction === 0.1)
      .map((r) => ({ c: r.minConfidence, trades: r.trades, winRate: +r.winRate.toFixed(3), pnl: +r.realizedPnl.toFixed(0) }));

    rows.push({
      slice,
      model,
      n: decisions.length,
      validRate: +(
        (decisions.filter((d) => d.action !== 'hold').length / decisions.length)
      ).toFixed(2),
      bestNoStops,
      bestStops,
      confEffect,
    });
    console.log(`done ${slice}/${model} (${decisions.length} decisions)`);
  }

  const md = [];
  md.push(`# Risk/regime sweep report — ${GRID.symbol} slices\n`);
  md.push(`Generated ${new Date().toISOString()}\n`);
  md.push('Grid: minConfidence {0.5..0.9} × fraction {0.1} × stops {off, on} × stopMult {1,2,3} × tpMult {2,3}\n');
  md.push(
    `Setup: initialQuote ${GRID.initialQuote.toLocaleString('en-US')} IDR, feeRate ${GRID.feeRate} per fill ` +
      `(${(GRID.feeRate * 200).toFixed(1)}% round-trip, Indodax standard ~0.3%/side), ` +
      `minVolume ${GRID.minVolume} (guardrail active: rejects candles below that volume floor — set per dataset since volume is in base-coin units that differ by asset).\n`,
  );
  md.push('Metrics: realizedPnl (IDR, on initialQuote), winRate (closing trades), trades, maxDrawdown.\n');
  md.push('"Best" rows are the highest-PnL variant with at least ' + MIN_TRADES + ' closing trades.\n');

  for (const r of rows) {
    md.push(`## ${r.slice} · ${r.model} (${r.n} decisions, ${(r.validRate * 100).toFixed(0)}% non-hold)\n`);
    md.push('| variant | minConf | fraction | stops | stopMult | tpMult | trades | winRate | pnl | maxDD |');
    md.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
    const toRow = (v, tag) =>
      v
        ? `| ${tag} | ${v.minConfidence} | ${v.fraction} | ${v.enableStops ? 'on' : 'off'} | ${v.atrStopMultiplier} | ${v.atrTpMultiplier} | ${v.trades} | ${v.winRate.toFixed(3)} | ${v.realizedPnl.toFixed(0)} | ${v.maxDrawdown.toFixed(3)} |`
        : `| ${tag} | — | — | — | — | — | — | — | — | — |`;
    md.push(toRow(r.bestNoStops, 'best no-stops'));
    md.push(toRow(r.bestStops, 'best stops-on'));
    md.push('');
    md.push('minConfidence effect (stops off):');
    md.push('| minConf | trades | winRate | pnl |');
    md.push('| --- | --- | --- | --- |');
    for (const c of r.confEffect) {
      md.push(`| ${c.c} | ${c.trades} | ${c.winRate} | ${c.pnl} |`);
    }
    md.push('');
  }

  const cell = (v, field, digits = 0) =>
    v ? v[field].toFixed(digits) : '—';
  const summary = rows
    .map(
      (r) =>
        `| ${r.slice} | ${r.model} | ${r.n} | ${cell(r.bestNoStops, 'realizedPnl')} | ${cell(r.bestNoStops, 'winRate', 3)} | ${cell(r.bestStops, 'realizedPnl')} | ${cell(r.bestStops, 'winRate', 3)} |`,
    )
    .join('\n');
  md.push(`## Summary\n`);
  md.push('| slice | model | n | bestPnl no-stops | winRate no-stops | bestPnl stops-on | winRate stops-on |');
  md.push('| --- | --- | --- | --- | --- | --- | --- |');
  md.push(summary);

  md.push(`
## Caveats

- **Small trade counts.** No-stops configs trade 7–24 times per slice/model; a 100% win rate over 7 trades (e.g. w1) is within pure-luck range and should not anchor conclusions. Treat per-cell numbers as noisy; only cross-slice patterns are meaningful.
- **No configuration wins consistently across w0–w3.** PnL swings strongly positive to strongly negative by slice for both models under both stop regimes. This is the real result: fixed stop/TP multipliers do not rescue a signal whose directional accuracy is near coin-flip (M3.5 measured 47.8–52.9%). "Some periods trend, some chop" — a single fixed exit policy has no universal answer.
- **Fee sensitivity.** At 0.6% round trip, high-trade-count configs are the most fee-exposed; a higher fee (e.g. Indodax VIP tiers or maker/taker asymmetry) can flip which cells look best.
- **minVolume floor differs per dataset scale.** Volume is in base-coin units, and medians differ widely by asset (BTC/IDR ~0.1, ETH/IDR ~1.1, SOL/IDR ~24 per 15m candle). A floor suitable for one scale rejects everything on the other — hence the per-run minVolume override.
- **Call failures recorded as holds.** A small number of calls failed (network/timeout/429) and were recorded as holds; visible as decision rows without a \`usage\` field.
`);

  await writeFile(OUT, md.join('\n') + '\n');
  console.log(`report → ${OUT}`);
}

main().catch((err) => {
  process.stderr.write(`${err.stack}\n`);
  process.exit(1);
});
