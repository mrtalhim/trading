// Pulls daily USD/IDR reference rates from the ECB via frankfurter.app into a
// committed snapshot for the M3.8-style USD/IDR context-arm experiment.
//
// ECB reference rates publish on business days only (no weekend/IDR-holiday
// values), so the snapshot is forward-filled onto every calendar day: the rate
// for a given day is the last published rate on or before it. This matters for
// strict causality in the context arm — the LLM must never see a future day's
// rate, and a weekend decision candle still needs a lookup.
//
// Frankfurter is the free, keyless ECB endpoint (deep history, ~business-day
// cadence). Bank Indonesia's api.bi.go.id requires an API key and returned
// empty in a no-auth probe, so frankfurter is the primary source.
//
// Usage:
//   node scripts/pull-usdidr.mjs                        # full coverage (default from 2018-01-01)
//   node scripts/pull-usdidr.mjs --from 2025-01-01      # narrower range
//   node scripts/pull-usdidr.mjs --out /tmp/usdidr.json
//
// Writes packages/llm/data/usdidr.json:
//   {
//     source: 'ecb-frankfurter',
//     coverageStart, coverageEnd,   // inclusive calendar dates covered
//     dailyForwardFilled: true,
//     rates: { "YYYY-MM-DD": 16431.0, ... }
//   }

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const API = 'https://api.frankfurter.app';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const val = argv[i + 1];
    if (val !== undefined && !val.startsWith('--')) {
      args[key] = val;
      i++;
    } else {
      args[key] = 'true';
    }
  }
  return {
    from: args.from ?? '2018-01-01',
    out: args.out ?? join(process.cwd(), 'packages', 'llm', 'data', 'usdidr.json'),
  };
}

function toIso(d) {
  return d.toISOString().slice(0, 10);
}

/** Yields [startIso, endIso] chunks of at most `days` each (frankfurter caps range length). */
function* chunks(fromIso, days = 180) {
  let start = new Date(`${fromIso}T00:00:00Z`);
  const now = new Date();
  while (start < now) {
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + days - 1);
    const capped = end > now ? now : end;
    yield [toIso(start), toIso(capped)];
    start = new Date(capped);
    start.setUTCDate(start.getUTCDate() + 1);
  }
}

async function fetchRange(fromIso, toIso) {
  const url = `${API}/${fromIso}..${toIso}?from=USD&to=IDR`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`frankfurter ${res.status} for ${fromIso}..${toIso}`);
  const data = await res.json();
  if (!data.rates || typeof data.rates !== 'object') {
    throw new Error(`frankfurter: no rates in range ${fromIso}..${toIso}`);
  }
  const out = {};
  for (const [date, rates] of Object.entries(data.rates)) {
    const idr = Number(rates.IDR);
    if (Number.isFinite(idr) && idr > 0) out[date] = idr;
  }
  return out;
}

/** Fills every calendar day between min and max with the last known rate (inclusive, forward-fill). */
function forwardFill(rateByDate) {
  const dates = Object.keys(rateByDate).sort();
  if (dates.length === 0) return {};
  const filled = {};
  let current = null;
  const start = new Date(`${dates[0]}T00:00:00Z`);
  const end = new Date(`${dates[dates.length - 1]}T00:00:00Z`);
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = toIso(d);
    if (rateByDate[iso] !== undefined) current = rateByDate[iso];
    if (current !== null) filled[iso] = current;
  }
  return filled;
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const collected = {};
  let first = null;
  let last = null;
  for (const [fromIso, toIso] of chunks(a.from)) {
    const rates = await fetchRange(fromIso, toIso);
    Object.assign(collected, rates);
    if (Object.keys(rates).length > 0) {
      first ??= fromIso;
      last = toIso;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  const filled = forwardFill(collected);
  const dates = Object.keys(filled).sort();
  if (dates.length === 0) throw new Error('no USD/IDR data collected');

  const snapshot = {
    source: 'ecb-frankfurter',
    base: 'USD',
    quote: 'IDR',
    coverageStart: dates[0],
    coverageEnd: dates[dates.length - 1],
    rawRateDates: Object.keys(collected).length,
    dailyForwardFilled: true,
    rates: filled,
  };
  await mkdir(join(a.out, '..'), { recursive: true });
  await writeFile(a.out, JSON.stringify(snapshot, null, 2) + '\n');
  console.log(
    `wrote ${Object.keys(filled).length} daily USD/IDR rates (${dates[0]} → ${dates[dates.length - 1]}, ${snapshot.rawRateDates} raw business-day observations) → ${a.out}`,
  );
}

main().catch((err) => {
  process.stderr.write(`${err.stack}\n`);
  process.exit(1);
});
