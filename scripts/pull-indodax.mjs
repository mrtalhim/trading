import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const OUT = join(process.cwd(), 'datasets', 'realistic', 'btc_idr_15m_2026');
const SYMBOL = 'BTCIDR';
const TF = 15;
const CANDLES = 10020;
const INTERVAL_S = TF * 60;
const CACHE = '/tmp/opencode/idr15.json';

async function fetchBars() {
  try {
    return JSON.parse(await readFile(CACHE, 'utf8'));
  } catch {
    const now = Math.floor(Date.now() / 1000);
    const from = now - (CANDLES + 5) * INTERVAL_S;
    const url = `https://indodax.com/tradingview/history_v2?from=${from}&to=${now}&symbol=${SYMBOL}&tf=${TF}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`history_v2 failed: ${res.status}`);
    const data = await res.json();
    await writeFile(CACHE, JSON.stringify(data));
    return data;
  }
}

const bars = await fetchBars();
const candles = bars
  .map((b) => ({
    timestamp: Number(b.Time) * 1000,
    open: Number(b.Open),
    high: Number(b.High),
    low: Number(b.Low),
    close: Number(b.Close),
    volume: Number(b.Volume),
  }))
  .sort((a, b) => a.timestamp - b.timestamp)
  .slice(0, CANDLES);

const checksum = createHash('sha256').update(JSON.stringify(candles)).digest('hex').slice(0, 16);

const metadata = {
  exchange: 'indodax',
  pair: 'BTC/IDR',
  interval: '15m',
  timezone: 'UTC',
  source: 'indodax-public-api',
  start: candles[0].timestamp,
  end: candles[candles.length - 1].timestamp,
  candleCount: candles.length,
  checksum,
  includes: { candles: true, ticker: false, orderbook: false, trades: false },
};

await mkdir(OUT, { recursive: true });
await writeFile(join(OUT, 'metadata.json'), JSON.stringify(metadata, null, 2) + '\n');
await writeFile(
  join(OUT, 'candles.jsonl'),
  candles.map((c) => JSON.stringify(c)).join('\n') + '\n',
);
console.log('wrote', candles.length, 'candles to', OUT, 'checksum', checksum);
