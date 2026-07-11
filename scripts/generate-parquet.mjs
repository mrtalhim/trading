import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dir = resolve(import.meta.dirname, '../datasets/realistic/btc_15m_2024');
const lines = readFileSync(resolve(dir, 'candles.jsonl'), 'utf-8')
  .split('\n')
  .filter((l) => l.trim());
const candles = lines.map((l) => JSON.parse(l));

const { parquetWriteBuffer } = await import('hyparquet-writer');
const buffer = parquetWriteBuffer({
  columnData: [
    { name: 'timestamp', data: candles.map((c) => BigInt(c.timestamp)), type: 'INT64' },
    { name: 'open', data: candles.map((c) => c.open), type: 'DOUBLE' },
    { name: 'high', data: candles.map((c) => c.high), type: 'DOUBLE' },
    { name: 'low', data: candles.map((c) => c.low), type: 'DOUBLE' },
    { name: 'close', data: candles.map((c) => c.close), type: 'DOUBLE' },
    { name: 'volume', data: candles.map((c) => c.volume), type: 'DOUBLE' },
  ],
});
writeFileSync(resolve(dir, 'candles.parquet'), new Uint8Array(buffer));
console.log(`Wrote candles.parquet (${buffer.byteLength} bytes)`);
