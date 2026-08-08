import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { computeChecksum, validateCandles } from '../packages/datasets/dist/index.js';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = argv[i + 1];
      if (val !== undefined && !val.startsWith('--')) {
        args[key] = val;
        i++;
      } else {
        args[key] = 'true';
      }
    }
  }
  if (!args.dataset) throw new Error('--dataset <dir> is required');
  return {
    dataset: args.dataset,
    slices: Number(args.slices ?? 4),
    outDir: args['out-dir'] ?? join(args.dataset, '..', `${basename(args.dataset)}-slices`),
  };
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const metadata = JSON.parse(await readFile(join(a.dataset, 'metadata.json'), 'utf-8'));
  const raw = await readFile(join(a.dataset, 'candles.jsonl'), 'utf-8');
  const candles = raw
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l))
    .sort((x, y) => x.timestamp - y.timestamp);

  if (candles.length === 0) throw new Error(`no candles in ${a.dataset}`);
  if (a.slices < 1) throw new Error(`--slices must be >= 1, got ${a.slices}`);

  const perSlice = Math.floor(candles.length / a.slices);
  console.log(`slicing ${candles.length} candles into ${a.slices} contiguous windows (${perSlice}/slice)`);

  for (let i = 0; i < a.slices; i++) {
    const start = i * perSlice;
    const end = i === a.slices - 1 ? candles.length : start + perSlice;
    const slice = candles.slice(start, end);
    if (slice.length === 0) {
      console.log(`w${i}: empty, skipped`);
      continue;
    }

    const sliceMetadata = {
      ...metadata,
      start: slice[0].timestamp,
      end: slice[slice.length - 1].timestamp,
      candleCount: slice.length,
      checksum: computeChecksum(slice),
    };

    const errors = validateCandles(slice, metadata.interval);
    if (errors.length > 0) {
      console.error(`w${i}: VALIDATION FAILED: ${errors.join('; ')}`);
      process.exitCode = 1;
    }

    const outDir = join(a.outDir, `w${i}`);
    await mkdir(outDir, { recursive: true });
    await writeFile(
      join(outDir, 'candles.jsonl'),
      slice.map((c) => JSON.stringify(c)).join('\n') + '\n',
    );
    await writeFile(join(outDir, 'metadata.json'), JSON.stringify(sliceMetadata, null, 2) + '\n');
    console.log(
      `w${i}: ${slice.length} candles, ${new Date(slice[0].timestamp).toISOString()} → ${new Date(slice[slice.length - 1].timestamp).toISOString()}, checksum ${sliceMetadata.checksum}`,
    );
  }
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
