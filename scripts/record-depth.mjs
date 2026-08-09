// Records forward order-book snapshots from the Indodax public depth endpoint
// into an experiment dataset (candles.jsonl + orderbook.jsonl + metadata.json).
// `JsonlLoader` reads `orderbook.jsonl`, so that is the canonical snapshot name.
//
// Indodax has no order-book history, so the M3.7 orderflow A/B dataset has to
// be collected live. This script samples /api/depth/{pair} at each candle
// boundary (aligned to exchange server time) and maintains the matching 15m
// candles via /tradingview/history_v2. Snapshots are stamped with the candle
// close timestamp they represent, so replay looks them up by the decision
// candle's own timestamp (strict per-candle causality; see ROADMAP M3.7).
//
// Usage:
//   node scripts/record-depth.mjs                        # loop on BTCIDR (15m)
//   node scripts/record-depth.mjs --symbol ETHIDR --tf 60
//   node scripts/record-depth.mjs --once                 # single tick then exit
//   node scripts/record-depth.mjs --finalize             # full candle backfill, then exit
//
// Flags:
//   --symbol    uppercase Indodax ticker (default BTCIDR)
//   --tf        candle timeframe in minutes (default 15)
//   --out       output dir override (default datasets/experiments/orderflow-<name>-<tf>m-<year>)
//   --backfill  initial candle count on a fresh dir (default 500)
//   --candles   full-history candle target for --finalize (default 10020)
//   --once      run one boundary tick and exit
//   --finalize  backfill full candle history + rebuild metadata, then exit
//   --no-wait   tick immediately instead of sleeping to the next boundary

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { validateCandles } from '../packages/datasets/dist/index.js';

const BASE_URL = 'https://indodax.com';
const HISTORY_PATH = '/tradingview/history_v2';
const DEPTH_PATH = '/api/depth';
const SERVER_TIME_PATH = '/api/server_time';

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 3;
const MIN_INTERVAL_MS = 150;

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
  const symbol = (args.symbol ?? 'BTCIDR').toUpperCase();
  return {
    symbol,
    tf: Number(args.tf ?? 15),
    out: args.out,
    backfill: Number(args.backfill ?? 500),
    candles: Number(args.candles ?? 10020),
    once: args.once === 'true',
    finalize: args.finalize === 'true',
    noWait: args['no-wait'] === 'true',
  };
}

function pairName(symbol) {
  const s = symbol.toLowerCase();
  return s.endsWith('idr') ? `${s.slice(0, -3)}_idr` : s;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(url, retries = MAX_RETRIES) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const started = Date.now();
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await sleep(250 * 2 ** attempt);
    } finally {
      clearTimeout(timer);
      const elapsed = Date.now() - started;
      const wait = MIN_INTERVAL_MS - elapsed;
      if (wait > 0) await sleep(wait);
    }
  }
  throw lastErr;
}

async function fetchServerTimeMs() {
  const raw = await fetchJson(`${BASE_URL}${SERVER_TIME_PATH}`);
  const ms = Number(raw?.server_time);
  if (!Number.isFinite(ms) || ms <= 0) throw new Error(`bad server_time response: ${JSON.stringify(raw)}`);
  return ms;
}

async function fetchDepth(symbol, timestampMs) {
  const id = symbol.toLowerCase().replace(/[^a-z0-9]/g, '');
  const raw = await fetchJson(`${BASE_URL}${DEPTH_PATH}/${id}`);
  const toLevels = (arr, sortAsc) =>
    (Array.isArray(arr) ? arr : [])
      .map((level) => [Number(level[0]), Number(level[1])])
      .filter(([p, q]) => Number.isFinite(p) && Number.isFinite(q))
      .sort((a, b) => (sortAsc ? a[0] - b[0] : b[0] - a[0]));
  return {
    bids: toLevels(raw?.buy, false),
    asks: toLevels(raw?.sell, true),
    timestamp: timestampMs,
  };
}

async function fetchHistory(symbol, tf, fromSec, toSec) {
  const url =
    `${BASE_URL}${HISTORY_PATH}?from=${fromSec}&to=${toSec}&symbol=${symbol}&tf=${tf}`;
  const raw = await fetchJson(url);
  if (!Array.isArray(raw)) throw new Error(`history_v2 returned non-array for ${symbol}`);
  return raw
    .map((b) => ({
      timestamp: Number(b.Time) * 1000,
      open: Number(b.Open),
      high: Number(b.High),
      low: Number(b.Low),
      close: Number(b.Close),
      volume: Number(b.Volume),
    }))
    .filter((c) => Number.isFinite(c.timestamp) && c.timestamp > 0)
    .sort((a, b) => a.timestamp - b.timestamp);
}

async function loadLines(file) {
  try {
    const raw = await readFile(file, 'utf-8');
    return raw.split('\n').filter((l) => l.trim() !== '');
  } catch {
    return [];
  }
}

async function readState(outDir) {
  const [candleLines, depthLines] = await Promise.all([
    loadLines(join(outDir, 'candles.jsonl')),
    loadLines(join(outDir, 'orderbook.jsonl')),
  ]);
  const candles = candleLines.map((l) => JSON.parse(l));
  const depths = depthLines.map((l) => JSON.parse(l));
  return {
    candles,
    depths,
    candleTs: new Set(candles.map((c) => c.timestamp)),
    depthTs: new Set(depths.map((d) => d.timestamp)),
  };
}

function writeJsonl(file, rows) {
  const sorted = [...rows].sort((a, b) => a.timestamp - b.timestamp);
  return writeFile(file, sorted.map((r) => JSON.stringify(r)).join('\n') + '\n');
}

async function writeMetadata(outDir, symbol, tf, candles, depths) {
  const sorted = [...candles].sort((a, b) => a.timestamp - b.timestamp);
  const checksum = createHash('sha256').update(JSON.stringify(sorted)).digest('hex').slice(0, 16);
  const metadata = {
    exchange: 'indodax',
    pair: symbol.replace(/IDR$/, '/IDR'),
    interval: `${tf}m`,
    timezone: 'UTC',
    source: 'indodax-public-api',
    start: sorted[0]?.timestamp ?? 0,
    end: sorted[sorted.length - 1]?.timestamp ?? 0,
    candleCount: sorted.length,
    checksum,
    includes: { candles: true, ticker: false, orderbook: true, trades: false },
  };
  await writeFile(join(outDir, 'metadata.json'), JSON.stringify(metadata, null, 2) + '\n');
}

async function finalize(a, outDir, state) {
  const nowSec = Math.floor(Date.now() / 1000);
  const fromSec = nowSec - (a.candles + 5) * a.tf * 60;
  const fresh = await fetchHistory(a.symbol, a.tf, fromSec, nowSec);
  const merged = [...state.candles];
  const seen = new Set(state.candleTs);
  for (const c of fresh) {
    if (!seen.has(c.timestamp)) {
      merged.push(c);
      seen.add(c.timestamp);
    }
  }
  await writeJsonl(join(outDir, 'candles.jsonl'), merged);
  await writeMetadata(outDir, a.symbol, a.tf, merged, state.depths);
  console.log(
    `finalized ${merged.length} candles (${state.depths.length} depth snapshots) → ${outDir}`,
  );
}

async function backfill(a, outDir, state) {
  if (state.candles.length > 0) return;
  const nowSec = Math.floor(Date.now() / 1000);
  const fromSec = nowSec - (a.backfill + 5) * a.tf * 60;
  const bars = await fetchHistory(a.symbol, a.tf, fromSec, nowSec);
  for (const c of bars) {
    if (!state.candleTs.has(c.timestamp)) {
      state.candles.push(c);
      state.candleTs.add(c.timestamp);
    }
  }
  await writeJsonl(join(outDir, 'candles.jsonl'), state.candles);
  console.log(`backfilled ${state.candles.length} candles into ${outDir}`);
}

async function runTick(a, outDir, state, skewMs) {
  const period = a.tf * 60 * 1000;
  const boundary = Math.floor((Date.now() + skewMs) / period) * period;

  // Snapshot depth at the boundary that just closed, stamped with that
  // boundary (strict per-candle causality: the probe only ever uses the
  // snapshot keyed to the decision candle's own close timestamp).
  if (!state.depthTs.has(boundary)) {
    const book = await fetchDepth(a.symbol, boundary);
    state.depths.push(book);
    state.depthTs.add(boundary);
    console.log(
      `${new Date(boundary).toISOString()} depth ${book.bids.length} bids / ${book.asks.length} asks`,
    );
  }

  // Pull closed candles around the boundary; add any we have not seen.
  const fromSec = Math.floor((boundary - 40 * period) / 1000);
  const toSec = Math.floor((Date.now() + skewMs) / 1000);
  const bars = await fetchHistory(a.symbol, a.tf, fromSec, toSec);
  for (const c of bars) {
    if (c.timestamp <= boundary && !state.candleTs.has(c.timestamp)) {
      state.candles.push(c);
      state.candleTs.add(c.timestamp);
    }
  }
  await Promise.all([
    writeJsonl(join(outDir, 'candles.jsonl'), state.candles),
    writeJsonl(join(outDir, 'orderbook.jsonl'), state.depths),
  ]);
  await writeMetadata(outDir, a.symbol, a.tf, state.candles, state.depths);
}

/** Fire this many ms after the boundary so `floor()` lands on the closed candle. */
const BOUNDARY_AFTER_MS = 2000;

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const period = a.tf * 60 * 1000;
  const year = new Date().getUTCFullYear();
  const outDir =
    a.out ?? join(process.cwd(), 'datasets', 'experiments', `orderflow-${pairName(a.symbol)}-${a.tf}m-${year}`);
  await mkdir(outDir, { recursive: true });

  const state = await readState(outDir);

  if (a.finalize) {
    await finalize(a, outDir, state);
    return;
  }
  if (state.candles.length === 0) {
    await backfill(a, outDir, state);
  }

  // Resync clock at startup; /api/server_time first call can take a few seconds.
  let skewMs = (await fetchServerTimeMs()) - Date.now();
  let lastSync = Date.now();

  while (true) {
    if (Date.now() - lastSync > 30 * 60 * 1000) {
      skewMs = (await fetchServerTimeMs()) - Date.now();
      lastSync = Date.now();
    }

    // Sleep until shortly after the next boundary in exchange time, then tick.
    // `runTick` uses floor() on the current exchange time, so it lands on the
    // boundary that just closed — no ceil() skip between sleep and tick.
    if (!a.noWait) {
      const nextBoundary = Math.ceil((Date.now() + skewMs) / period) * period;
      const targetLocal = nextBoundary - skewMs + BOUNDARY_AFTER_MS;
      const waitMs = targetLocal - Date.now();
      if (waitMs > 0) {
        await sleep(Math.min(waitMs, 15 * 60 * 1000));
      }
    }
    await runTick(a, outDir, state, skewMs);

    if (a.once) return;
  }
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
