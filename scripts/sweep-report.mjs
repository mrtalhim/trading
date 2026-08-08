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
  minVolume: process.argv[6] !== undefined ? Number(process.argv[6]) : 0,
  minConfidences: [0.5, 0.6, 0.7, 0.8, 0.9],
  fractions: [0.1],
  stopMultipliers: [1, 2, 3],
  tpMultipliers: [2, 3],
};

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
    const best = (rs) => rs.reduce((a, r) => (r.realizedPnl > a.realizedPnl ? r : a));

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
        (decisions.filter((d) => d.action !== 'hold' || d.confidence > 0).length / decisions.length)
      ).toFixed(2),
      bestNoStops,
      bestStops,
      confEffect,
    });
    console.log(`done ${slice}/${model} (${decisions.length} decisions)`);
  }

  const md = [];
  md.push(`# Risk/regime sweep report — ${GRID.symbol} slices (free models)\n`);
  md.push(`Generated ${new Date().toISOString()}\n`);
  md.push('Grid: minConfidence {0.5..0.9} × fraction {0.1} × stops {off, on} × stopMult {1,2,3} × tpMult {2,3}\n');
  md.push(
    `Setup: initialQuote ${GRID.initialQuote.toLocaleString('en-US')}, minVolume ${GRID.minVolume} ` +
      '(IDR volume column is in BTC units ~0.02, so the default floor of 100 rejects every entry), feeRate 0.\n',
  );
  md.push('Metrics: realizedPnl, winRate (closing trades), trades, maxDrawdown.\n');

  for (const r of rows) {
    md.push(`## ${r.slice} · ${r.model} (${r.n} decisions, ${(r.validRate * 100).toFixed(0)}% non-hold)\n`);
    md.push('| variant | minConf | fraction | stops | stopMult | tpMult | trades | winRate | pnl | maxDD |');
    md.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
    const toRow = (v, tag) =>
      `| ${tag} | ${v.minConfidence} | ${v.fraction} | ${v.enableStops ? 'on' : 'off'} | ${v.atrStopMultiplier} | ${v.atrTpMultiplier} | ${v.trades} | ${v.winRate.toFixed(3)} | ${v.realizedPnl.toFixed(0)} | ${v.maxDrawdown.toFixed(3)} |`;
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

  const summary = rows
    .map(
      (r) =>
        `| ${r.slice} | ${r.model} | ${r.n} | ${r.bestNoStops.realizedPnl.toFixed(0)} | ${r.bestNoStops.winRate.toFixed(3)} | ${r.bestStops.realizedPnl.toFixed(0)} | ${r.bestStops.winRate.toFixed(3)} |`,
    )
    .join('\n');
  md.push(`## Summary\n`);
  md.push('| slice | model | n | bestPnl no-stops | winRate no-stops | bestPnl stops-on | winRate stops-on |');
  md.push('| --- | --- | --- | --- | --- | --- | --- |');
  md.push(summary);

  await writeFile(OUT, md.join('\n') + '\n');
  console.log(`report → ${OUT}`);
}

main().catch((err) => {
  process.stderr.write(`${err.stack}\n`);
  process.exit(1);
});
