import { writeFile } from 'node:fs/promises';
import { BacktestEngine, loadDataset, type BacktestConfig } from './engine.js';
import { loadDecisions } from './decisions.js';
import { recordDecisions, writeDecisions } from './record.js';
import type { ContextKind } from '@trading/llm';
import { createDecisionEngine, createEngineFromPreset } from '@trading/llm';

interface CliArgs {
  dataset: string;
  decisions?: string;
  symbol: string;
  base: string;
  quote: string;
  cash: number;
  feeRate: number;
  fraction: number;
  atrStopMultiplier: number;
  out?: string;
  record: boolean;
  preset?: string;
  provider?: string;
  model?: string;
  baseUrl?: string;
  apiKey?: string;
  sampleEvery: number;
  lookback: number;
  timeout: number;
  context: ContextKind;
}

const CONTEXT_KINDS: ContextKind[] = ['baseline', 'indicators', 'patterns', 'orderflow'];

export function parseContext(value: string): ContextKind {
  if (!CONTEXT_KINDS.includes(value as ContextKind)) {
    throw new Error(`invalid --context '${value}'. expected one of: ${CONTEXT_KINDS.join(', ')}`);
  }
  return value as ContextKind;
}

export function parseArgs(argv: string[]): CliArgs {
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
  if (!args.decisions && !args.record)
    throw new Error('--decisions <file> or --record is required');
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
    record: args.record === 'true',
    preset: args.preset,
    provider: args.provider,
    model: args.model,
    baseUrl: args.baseUrl,
    apiKey: args.apiKey,
    sampleEvery: Number(args.sampleEvery ?? 1),
    lookback: Number(args.lookback ?? 20),
    timeout: Number(args.timeout ?? 10_000),
    context: parseContext(args.context ?? 'baseline'),
  };
}

export async function runBacktestCli(argv: string[] = process.argv.slice(2)): Promise<void> {
  const a = parseArgs(argv);
  const dataset = loadDataset(a.dataset);

  if (a.record) {
    const apiKey = a.apiKey ?? process.env.OPENROUTER_API_KEY ?? '';
    if (!apiKey) throw new Error('--api-key or OPENROUTER_API_KEY env required for --record');

    const engine = a.preset
      ? createEngineFromPreset(a.preset, apiKey, a.timeout)
      : createDecisionEngine({
          kind: (a.provider ?? 'openai') as 'openai' | 'anthropic',
          model: a.model ?? 'google/gemma-4-31b-it:free',
          baseURL: a.baseUrl,
          apiKey,
          timeoutMs: a.timeout,
        });
    const decisions = await recordDecisions(dataset, engine, {
      symbol: a.symbol,
      sampleEvery: a.sampleEvery,
      lookback: a.lookback,
      context: a.context,
      model: a.preset ?? a.model,
    });

    const outPath = a.out ?? a.dataset.replace(/\//g, '-') + '-decisions.jsonl';
    await writeDecisions(decisions, outPath);
    process.stdout.write(`recorded ${decisions.length} decisions → ${outPath}\n`);
    return;
  }

  const decisions = await loadDecisions(a.decisions!);

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
