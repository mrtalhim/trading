import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const BINANCE_API = 'https://api.binance.com/api/v3/klines';
const SYMBOL = 'BTCUSDT';
const INTERVAL = '15m';
const LIMIT = 1000;

// Jan 1 2024 to ~Jan 11 2024 (1000 candles * 15m = 10.4 days)
const START = Date.UTC(2024, 0, 1, 0, 0, 0);

async function downloadKlines() {
  const url = `${BINANCE_API}?symbol=${SYMBOL}&interval=${INTERVAL}&startTime=${START}&limit=${LIMIT}`;
  console.log(`Downloading from: ${url}`);

  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Binance API error: ${resp.status} ${resp.statusText}`);
  }

  const raw = await resp.json();
  console.log(`Received ${raw.length} klines`);

  // Binance kline format: [openTime, open, high, low, close, volume, closeTime, ...]
  const candles = raw.map((k) => ({
    timestamp: k[0],
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));

  return candles;
}

function computeChecksum(candles) {
  const sorted = [...candles].sort((a, b) => a.timestamp - b.timestamp);
  return createHash('sha256').update(JSON.stringify(sorted)).digest('hex').slice(0, 16);
}

async function main() {
  const candles = await downloadKlines();

  const dir = resolve(import.meta.dirname, '../datasets/realistic/btc_15m_2024');
  mkdirSync(dir, { recursive: true });

  // Write JSONL
  writeFileSync(
    resolve(dir, 'candles.jsonl'),
    candles.map((c) => JSON.stringify(c)).join('\n') + '\n',
  );

  // Write metadata
  const checksum = computeChecksum(candles);
  const metadata = {
    exchange: 'binance',
    pair: 'BTCUSDT',
    interval: '15m',
    timezone: 'UTC',
    source: 'binance-public-api',
    start: candles[0].timestamp,
    end: candles[candles.length - 1].timestamp,
    candleCount: candles.length,
    checksum,
    includes: { candles: true, ticker: false, orderbook: false, trades: false },
  };
  writeFileSync(resolve(dir, 'metadata.json'), JSON.stringify(metadata, null, 2) + '\n');

  console.log(`Wrote ${candles.length} candles to ${dir}`);
  console.log(`Checksum: ${checksum}`);
  console.log(`First candle: ${new Date(candles[0].timestamp).toISOString()}`);
  console.log(`Last candle: ${new Date(candles[candles.length - 1].timestamp).toISOString()}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
