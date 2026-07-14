import { writeFile } from 'node:fs/promises';
import { BacktestEngine, loadDataset, type BacktestConfig } from './engine.js';
import { loadDecisions } from './decisions.js';

interface CliArgs {
  dataset: string;
  decisions: string;
  symbol: string;
  base: string;
  quote: string;
  cash: number;
  feeRate: number;
  fraction: number;
  atrStopMultiplier: number;
  out?: string;
}

function parseArgs(argv: string[]): CliArgs {
  const args: Record<string, string> = {};
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
  if (!args.decisions) throw new Error('--decisions <file> is required');
  const symbol = args.symbol ?? 'BTC/USDT';
  const [base, quote] = symbol.split('/');
  if (!base || !quote) throw new Error(`invalid --symbol (expected BASE/QUOTE): ${symbol}`);
  return {
    dataset: args.dataset,
    decisions: args.decisions,
    symbol,
    base,
    quote,
    cash: Number(args.cash ?? 10000),
    feeRate: Number(args.feeRate ?? 0),
    fraction: Number(args.fraction ?? 0.1),
    atrStopMultiplier: Number(args.atrStopMultiplier ?? 2),
    out: args.out,
  };
}

export async function runBacktestCli(argv: string[] = process.argv.slice(2)): Promise<void> {
  const a = parseArgs(argv);
  const dataset = loadDataset(a.dataset);
  const decisions = await loadDecisions(a.decisions);

  const config: BacktestConfig = {
    dataset,
    decisions,
    symbol: a.symbol,
    base: a.base,
    quote: a.quote,
    initialQuote: a.cash,
    feeRate: a.feeRate,
    sizing: { fraction: a.fraction },
    atrStopMultiplier: a.atrStopMultiplier,
  };

  const result = await new BacktestEngine(config).run();
  const json = JSON.stringify(result, null, 2);
  if (a.out) {
    await writeFile(a.out, json + '\n');
  } else {
    process.stdout.write(json + '\n');
  }
  process.stdout.write(`checksum: ${result.checksum}\n`);
}

// Allow direct execution: `node dist/cli.js ...`
if (import.meta.url === `file://${process.argv[1]}`) {
  runBacktestCli().catch((err) => {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}
