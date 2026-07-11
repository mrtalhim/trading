import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const INTERVAL_MS = 900_000; // 15m
const BASE_TIME = 1700000000000; // Nov 2023

function generateCandles(config) {
  const { startPrice, volatility, trendPhases, volumeBase, seed } = config;
  const candles = [];
  let price = startPrice;
  let rng = seed;

  function nextRandom() {
    rng = (rng * 1664525 + 1013904223) & 0xffffffff;
    return (rng >>> 0) / 0xffffffff;
  }

  for (let i = 0; i < 100; i++) {
    const phase = trendPhases[Math.min(Math.floor(i / (100 / trendPhases.length)), trendPhases.length - 1)];
    const drift = phase === 'up' ? 0.002 : phase === 'down' ? -0.002 : phase === 'flat' ? 0 : phase === 'spike' ? 0.008 : -0.005;
    const change = (nextRandom() - 0.5) * volatility + drift;
    const open = price;
    const close = open * (1 + change);
    const wickUp = Math.abs(nextRandom() * volatility * 0.5);
    const wickDown = Math.abs(nextRandom() * volatility * 0.5);
    const high = Math.max(open, close) * (1 + wickUp);
    const low = Math.min(open, close) * (1 - wickDown);
    const volume = volumeBase * (0.5 + nextRandom() * 1.5);

    candles.push({
      timestamp: BASE_TIME + i * INTERVAL_MS,
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume: Math.round(volume * 100) / 100,
    });

    price = close;
  }
  return candles;
}

function computeChecksum(candles) {
  const sorted = [...candles].sort((a, b) => a.timestamp - b.timestamp);
  return createHash('sha256').update(JSON.stringify(sorted)).digest('hex').slice(0, 16);
}

function writeDataset(name, pair, candles, dir) {
  const datasetDir = resolve(dir, name);
  mkdirSync(datasetDir, { recursive: true });

  const checksum = computeChecksum(candles);
  const metadata = {
    exchange: 'synthetic',
    pair,
    interval: '15m',
    timezone: 'UTC',
    source: 'hand-crafted',
    start: candles[0].timestamp,
    end: candles[candles.length - 1].timestamp,
    candleCount: candles.length,
    checksum,
    includes: { candles: true, ticker: false, orderbook: false, trades: false },
  };

  writeFileSync(resolve(datasetDir, 'metadata.json'), JSON.stringify(metadata, null, 2) + '\n');
  writeFileSync(resolve(datasetDir, 'candles.jsonl'), candles.map((c) => JSON.stringify(c)).join('\n') + '\n');
  console.log(`Wrote ${name}: ${candles.length} candles, checksum=${checksum}`);
}

const DATASETS_DIR = resolve(import.meta.dirname, '../datasets/golden');

// BTC: volatile with trend phases - flat, up, spike, down, recovery
const btcCandles = generateCandles({
  startPrice: 42000,
  volatility: 0.015,
  trendPhases: ['flat', 'flat', 'up', 'up', 'spike', 'down', 'down', 'flat', 'up', 'up'],
  volumeBase: 150,
  seed: 42,
});

// ETH: steady uptrend with one flash crash
const ethCandles = generateCandles({
  startPrice: 2200,
  volatility: 0.012,
  trendPhases: ['up', 'up', 'up', 'up', 'crash', 'down', 'up', 'up', 'up', 'up'],
  volumeBase: 200,
  seed: 137,
});

// SOL: highly volatile with multiple direction changes
const solCandles = generateCandles({
  startPrice: 95,
  volatility: 0.025,
  trendPhases: ['up', 'down', 'up', 'down', 'up', 'down', 'up', 'down', 'up', 'down'],
  volumeBase: 300,
  seed: 256,
});

writeDataset('btc_15m', 'BTCUSDT', btcCandles, DATASETS_DIR);
writeDataset('eth_15m', 'ETHUSDT', ethCandles, DATASETS_DIR);
writeDataset('sol_15m', 'SOLUSDT', solCandles, DATASETS_DIR);

console.log('\nGolden datasets created.');
