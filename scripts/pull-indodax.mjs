// Pulls real OHLC candles from the Indodax public TradingView history endpoint
// into a canonical dataset dir (candles.jsonl + metadata.json, checksummed).
//
// Resolve symbols via /tradingview/search_v2 first — history_v2 hangs ~30 s on
// unknown symbols (see AGENTS.md). This script takes the uppercase ticker
// (e.g. ETHIDR) as `--symbol`.
//
// Usage:
//   node scripts/pull-indodax.mjs                        # default: BTCIDR
//   node scripts/pull-indodax.mjs --symbol ETHIDR
//   node scripts/pull-indodax.mjs --symbol SOLIDR --candles 10020
//
// Flags:
//   --symbol  uppercase Indodax ticker (default BTCIDR)
//   --tf      timeframe in minutes (default 15)
//   --candles target candle count (default 10020)
//   --out     output dir override (default datasets/realistic/<name>_15m_<year>)
//   --from    explicit window start, epoch seconds or ISO (e.g. 2025-09-01)
//   --to      explicit window end, epoch seconds or ISO (default: now)
//   --no-cache  force a live fetch instead of reusing the per-window cache

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { validateCandles } from '../packages/datasets/dist/index.js';

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
  const to = parseTs(args.to ?? 'now');
  const from = args.from !== undefined ? parseTs(args.from) : to - (Number(args.candles ?? 10020) + 5) * Number(args.tf ?? 15) * 60;
  return {
    symbol,
    tf: Number(args.tf ?? 15),
    candles: Number(args.candles ?? 10020),
    from,
    to,
    out: args.out,
    noCache: args['no-cache'] === 'true',
  };
}

/** Coerces an epoch-seconds number, an ISO string, or 'now' onto epoch seconds. */
function parseTs(value) {
  if (value === 'now') return Math.floor(Date.now() / 1000);
  const n = Number(value);
  if (Number.isFinite(n)) return Math.floor(n);
  const ms = Date.parse(value);
  if (Number.isFinite(ms)) return Math.floor(ms / 1000);
  throw new Error(`cannot parse timestamp '${value}' (use epoch seconds or ISO)`);
}

function pairName(symbol) {
  const s = symbol.toLowerCase();
  return s.endsWith('idr') ? `${s.slice(0, -3)}_idr` : s;
}

async function fetchBars(a, cachePath) {
  if (!a.noCache) {
    try {
      return JSON.parse(await readFile(cachePath, 'utf8'));
    } catch {
      /* no cache yet */
    }
  }
  const url = `https://indodax.com/tradingview/history_v2?from=${a.from}&to=${a.to}&symbol=${a.symbol}&tf=${a.tf}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`history_v2 failed for ${a.symbol}: ${res.status}`);
  const data = await res.json();
  await writeFile(cachePath, JSON.stringify(data));
  return data;
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const cachePath = `/tmp/opencode/history-${a.symbol.toLowerCase()}-${a.from ?? 'last'}-${a.to ?? 'now'}.json`;
  const bars = await fetchBars(a, cachePath);

  const candles = bars
    .map((b) => ({
      timestamp: Number(b.Time) * 1000,
      open: Number(b.Open),
      high: Number(b.High),
      low: Number(b.Low),
      close: Number(b.Close),
      volume: Number(b.Volume),
    }))
    .filter((c) => Number.isFinite(c.timestamp) && c.timestamp > 0)
    .sort((x, y) => x.timestamp - y.timestamp)
    .slice(0, a.candles);

  if (candles.length === 0) throw new Error(`no candles returned for ${a.symbol}`);

  const interval = `${a.tf}m`;
  const validation = validateCandles(candles, interval);
  if (!validation.valid) {
    console.error(`VALIDATION WARNINGS for ${a.symbol} (${validation.errors.length}):`);
    for (const e of validation.errors.slice(0, 20)) {
      console.error(`  ${e.type}: ${e.message}`);
    }
    if (validation.errors.length > 20) {
      console.error(`  ... and ${validation.errors.length - 20} more`);
    }
  }

  const checksum = createHash('sha256').update(JSON.stringify(candles)).digest('hex').slice(0, 16);
  const year = new Date(candles[candles.length - 1].timestamp).getUTCFullYear();
  const outDir = a.out ?? join(process.cwd(), 'datasets', 'realistic', `${pairName(a.symbol)}_${a.tf}m_${year}`);

  const metadata = {
    exchange: 'indodax',
    pair: a.symbol.replace(/IDR$/, '/IDR'),
    interval,
    timezone: 'UTC',
    source: 'indodax-public-api',
    start: candles[0].timestamp,
    end: candles[candles.length - 1].timestamp,
    candleCount: candles.length,
    checksum,
    includes: { candles: true, ticker: false, orderbook: false, trades: false },
  };

  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'metadata.json'), JSON.stringify(metadata, null, 2) + '\n');
  await writeFile(
    join(outDir, 'candles.jsonl'),
    candles.map((c) => JSON.stringify(c)).join('\n') + '\n',
  );
  console.log(
    `wrote ${candles.length} candles to ${outDir} (checksum ${checksum}) — ${new Date(candles[0].timestamp).toISOString()} → ${new Date(candles[candles.length - 1].timestamp).toISOString()}`,
  );
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
