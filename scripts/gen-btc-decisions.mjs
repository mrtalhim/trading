import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const GOLDEN = join(process.cwd(), 'datasets', 'golden', 'btc_15m', 'candles.jsonl');
const OUT = join(process.cwd(), 'tests', 'replay', 'fixtures', 'btc-decisions.jsonl');

const raw = await readFile(GOLDEN, 'utf-8');
const lines = raw.split('\n').filter((l) => l.trim() !== '');
const out = [];

lines.forEach((line, idx) => {
  const candle = JSON.parse(line);
  let action = 'hold';
  if (idx % 15 === 0) action = 'long';
  else if (idx % 15 === 7) action = 'short';
  const confidence = 0.6 + ((idx * 7) % 30) / 100;
  out.push(JSON.stringify({ timestamp: candle.timestamp, action, confidence }));
});

await writeFile(OUT, out.join('\n') + '\n');
process.stdout.write(`wrote ${out.length} decisions to ${OUT}\n`);
