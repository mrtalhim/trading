// Generates the Indodax-representative golden dataset at datasets/golden/btc_idr_15m.
//
// Indodax serves IDR-quoted pairs (e.g. BTC/IDR) with:
//   - timestamps in milliseconds, UTC (per /api/server_time)
//   - price tick of 1000 IDR for btc_idr (per /api/price_increments)
//   - BTC volume carrying ~8 decimals (e.g. 218.31103295)
//
// The existing golden datasets are Binance-style USDT pairs at 2-decimal precision,
// which do not exercise the precision/quote-currency behavior the guardrails and
// risk engine key off. This dataset makes the test corpus Indodax-shaped.
//
// Deterministic (seeded) so checksums are stable across regenerations.

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

// Inlined only because this dev script cannot resolve the workspace package under
// pnpm's node_modules layout. The golden-datasets test recomputes the checksum with
// the real `computeChecksum` from @trading/datasets and asserts it matches, so any
// divergence here is caught by CI.
function computeChecksum(candles) {
  const sorted = [...candles].sort((a, b) => a.timestamp - b.timestamp);
  return createHash('sha256').update(JSON.stringify(sorted)).digest('hex').slice(0, 16);
}

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

const rng = mulberry32(0x1d0d4a);
const INTERVAL_MS = 15 * 60 * 1000;
// Align to a UTC 15m boundary.
const START = 1699999200000;
const COUNT = 100;

const candles = [];

let prevClose = 1080000000; // IDR, multiple of 1000
for (let i = 0; i < COUNT; i++) {
  const timestamp = START + i * INTERVAL_MS;
  const open = prevClose;

  const stepTicks = Math.round((rng() - 0.5) * 4000); // -2000..2000 ticks of 1000 IDR
  let close = open + stepTicks * 1000;
  if (close <= 0) close = 1000;
  close = Math.round(close / 1000) * 1000;

  const wickUp = Math.round(rng() * 5000) * 1000;
  const wickDn = Math.round(rng() * 5000) * 1000;
  const high = Math.max(open, close) + wickUp;
  const low = Math.min(open, close) - wickDn;

  const volume = Number((0.5 + rng() * 49.5).toFixed(8)); // BTC, ~8 decimals

  candles.push({ timestamp, open, high, low, close, volume });
  prevClose = close;
}

const dir = join(process.cwd(), 'datasets', 'golden', 'btc_idr_15m');
mkdirSync(dir, { recursive: true });

const metadata = {
  exchange: 'indodax',
  pair: 'BTC/IDR',
  interval: '15m',
  timezone: 'UTC',
  source: 'synthetic-indodax',
  start: candles[0].timestamp,
  end: candles[candles.length - 1].timestamp,
  candleCount: candles.length,
  checksum: computeChecksum(candles),
  includes: {
    candles: true,
    ticker: false,
    orderbook: false,
    trades: false,
  },
};

writeFileSync(join(dir, 'metadata.json'), JSON.stringify(metadata, null, 2) + '\n');
writeFileSync(join(dir, 'candles.jsonl'), candles.map((c) => JSON.stringify(c)).join('\n') + '\n');

console.log(`Wrote ${candles.length} candles to ${dir} (checksum ${metadata.checksum})`);
