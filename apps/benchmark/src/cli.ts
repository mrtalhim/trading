import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { JsonlLoader } from '@trading/datasets';
import { loadDecisions } from '@trading/backtest';
import type { ContextKind } from '@trading/llm';
import { createEngineFromPreset, PRESETS } from '@trading/llm';
import type { ProbeResult } from './probe.js';
import { probeDecisions } from './probe.js';
import { scoreProbes, type ScoreResult } from './score.js';
import { buildLeaderboard } from './leaderboard.js';
import { forPairedBlocks } from './paired.js';

interface CliArgs {
  command: string;
  dataset: string;
  decisions?: string;
  probes?: string;
  scores?: string;
  control?: string;
  treatment?: string;
  blockSize: number;
  out?: string;
  outDir?: string;
  preset?: string;
  presets?: string;
  apiKey?: string;
  symbol: string;
  lookback: number;
  repeats: number;
  requestDelayMs: number;
  context: ContextKind;
  cash: number;
  fraction: number;
  feeRate: number;
  atrStopMultiplier: number;
  timeout: number;
}

const CONTEXT_KINDS: ContextKind[] = ['baseline', 'indicators', 'patterns'];

export function parseContext(value: string): ContextKind {
  if (!CONTEXT_KINDS.includes(value as ContextKind)) {
    throw new Error(`invalid --context '${value}'. expected one of: ${CONTEXT_KINDS.join(', ')}`);
  }
  return value as ContextKind;
}

export function parseArgs(argv: string[]): CliArgs {
  const args: Record<string, string> = {};
  let command = '';
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
    } else if (command === '') {
      command = a;
    }
  }
  return {
    command,
    dataset: args.dataset ?? '',
    decisions: args.decisions,
    probes: args.probes,
    scores: args.scores,
    control: args.control,
    treatment: args.treatment,
    blockSize: Number(args['block-size'] ?? 100),
    out: args.out,
    outDir: args['out-dir'],
    preset: args.preset,
    presets: args.presets,
    apiKey: args['api-key'],
    symbol: args.symbol ?? 'BTC/USDT',
    lookback: Number(args.lookback ?? 20),
    repeats: Number(args.repeats ?? 3),
    requestDelayMs: Number(args['request-delay'] ?? 0),
    context: parseContext(args.context ?? 'baseline'),
    cash: Number(args.cash ?? 10000),
    fraction: Number(args.fraction ?? 0.1),
    feeRate: Number(args['fee-rate'] ?? 0),
    atrStopMultiplier: Number(args['atr-stop'] ?? 2),
    timeout: Number(args.timeout ?? 10_000),
  };
}

export function envNameForPreset(preset: string): 'GEMINI_API_KEY' | 'OPENROUTER_API_KEY' {
  return PRESETS[preset]?.kind === 'gemini' ? 'GEMINI_API_KEY' : 'OPENROUTER_API_KEY';
}

function apiKeyForPreset(preset: string, override?: string): string {
  if (override) return override;
  const env = process.env[envNameForPreset(preset)];
  if (!env) {
    throw new Error(
      `no API key for preset '${preset}': pass --api-key or set ${envNameForPreset(preset)}`,
    );
  }
  return env;
}

function loadProbes(path: string): Promise<ProbeResult[]> {
  return readFile(path, 'utf-8').then((raw) =>
    raw
      .split('\n')
      .filter((l) => l.trim() !== '')
      .map((l) => JSON.parse(l) as ProbeResult),
  );
}

async function ensureDir(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
}

async function cmdProbe(a: CliArgs): Promise<void> {
  if (!a.dataset) throw new Error('--dataset <dir> is required');
  if (!a.decisions) throw new Error('--decisions <file> is required');
  if (!a.preset) throw new Error('--preset <name> is required');

  const dataset = new JsonlLoader(a.dataset);
  const recorded = await loadDecisions(a.decisions);
  const engine = createEngineFromPreset(a.preset, apiKeyForPreset(a.preset, a.apiKey), a.timeout);
  const probes = await probeDecisions(
    dataset,
    engine,
    recorded.map((d) => d.timestamp),
    {
      symbol: a.symbol,
      lookback: a.lookback,
      repeats: a.repeats,
      requestDelayMs: a.requestDelayMs,
      context: a.context,
    },
  );

  const out = a.out ?? `probes-${a.preset}.jsonl`;
  await ensureDir(out);
  await writeFile(out, probes.map((p) => JSON.stringify(p)).join('\n') + '\n');
  process.stdout.write(
    `probed ${probes.length} requests (${recorded.length} contexts × ${a.repeats}) → ${out}\n`,
  );
}

async function cmdScore(a: CliArgs): Promise<void> {
  if (!a.dataset) throw new Error('--dataset <dir> is required');
  if (!a.probes) throw new Error('--probes <file> is required');

  const dataset = new JsonlLoader(a.dataset);
  const probes = await loadProbes(a.probes);
  const score = await scoreProbes(dataset, probes, {
    symbol: a.symbol,
    initialQuote: a.cash,
    feeRate: a.feeRate,
    fraction: a.fraction,
    atrStopMultiplier: a.atrStopMultiplier,
  });

  const out = a.out ?? `score-${score.provider.replace(/[/:]/g, '-')}.json`;
  await ensureDir(out);
  await writeFile(out, JSON.stringify(score, null, 2) + '\n');
  process.stdout.write(`scored ${score.provider} → ${out}\n`);
}

async function cmdLeaderboard(a: CliArgs): Promise<void> {
  if (!a.scores) throw new Error('--scores <file,file,...> is required');
  if (!a.probes) throw new Error('--probes <file,file,...> is required');

  const scores: ScoreResult[] = [];
  for (const p of a.scores.split(',')) {
    const raw = await readFile(p, 'utf-8');
    scores.push(JSON.parse(raw) as ScoreResult);
  }
  const probes: ProbeResult[] = [];
  for (const p of a.probes.split(',')) {
    probes.push(...(await loadProbes(p)));
  }
  const lb = buildLeaderboard(probes, scores);

  const out = a.out ?? 'leaderboard.json';
  await ensureDir(out);
  await writeFile(out, JSON.stringify(lb, null, 2) + '\n');
  process.stdout.write(`leaderboard: ${lb.rows.length} providers → ${out}\n`);
}

async function cmdRun(a: CliArgs): Promise<void> {
  if (!a.dataset) throw new Error('--dataset <dir> is required');
  if (!a.decisions) throw new Error('--decisions <file> is required');
  if (!a.presets) throw new Error('--presets <name,name,...> is required');
  if (!a.outDir) throw new Error('--out-dir <dir> is required');

  await mkdir(a.outDir, { recursive: true });
  const dataset = new JsonlLoader(a.dataset);
  const recorded = await loadDecisions(a.decisions);
  const timestamps = recorded.map((d) => d.timestamp);

  const allProbes: ProbeResult[] = [];
  const scores: ScoreResult[] = [];
  for (const preset of a.presets.split(',')) {
    if (!PRESETS[preset]) {
      throw new Error(`unknown preset '${preset}'. available: ${Object.keys(PRESETS).join(', ')}`);
    }
    const engine = createEngineFromPreset(preset, apiKeyForPreset(preset, a.apiKey), a.timeout);
    const probes = await probeDecisions(dataset, engine, timestamps, {
      symbol: a.symbol,
      lookback: a.lookback,
      repeats: a.repeats,
      requestDelayMs: a.requestDelayMs,
      context: a.context,
    });
    allProbes.push(...probes);
    await writeFile(
      `${a.outDir}/probes-${preset}.jsonl`,
      probes.map((p) => JSON.stringify(p)).join('\n') + '\n',
    );

    const score = await scoreProbes(dataset, probes, {
      symbol: a.symbol,
      initialQuote: a.cash,
      feeRate: a.feeRate,
      fraction: a.fraction,
      atrStopMultiplier: a.atrStopMultiplier,
    });
    scores.push(score);
    await writeFile(`${a.outDir}/score-${preset}.json`, JSON.stringify(score, null, 2) + '\n');
    process.stdout.write(
      `[${preset}] validJson=${score.provider} probes=${probes.length} pnl=${score.backtest.realizedPnl.toFixed(2)}\n`,
    );
  }

  const lb = buildLeaderboard(allProbes, scores);
  await writeFile(`${a.outDir}/leaderboard.json`, JSON.stringify(lb, null, 2) + '\n');
  process.stdout.write('leaderboard written to ' + a.outDir + '/leaderboard.json\n');
}

async function cmdAbtest(a: CliArgs): Promise<void> {
  if (!a.dataset) throw new Error('--dataset <dir> is required');
  if (!a.control) throw new Error('--control <probes.jsonl> is required');
  if (!a.treatment) throw new Error('--treatment <probes.jsonl> is required');

  const dataset = new JsonlLoader(a.dataset);
  const control = await loadProbes(a.control);
  const treatment = await loadProbes(a.treatment);

  const result = await forPairedBlocks(dataset, control, treatment, {
    blockSize: a.blockSize,
    symbol: a.symbol,
  });

  const out = a.out ?? 'paired-ab.json';
  await ensureDir(out);
  await writeFile(out, JSON.stringify(result, null, 2) + '\n');
  process.stdout.write(
    `paired A/B → ${out} (${result.sampleSizePerArm} matched, CI pnl ${result.pnlDeltaCI95.join('..')})\n`,
  );
}

export async function runBenchmarkCli(argv: string[] = process.argv.slice(2)): Promise<void> {
  const a = parseArgs(argv);
  switch (a.command) {
    case 'probe':
      return cmdProbe(a);
    case 'score':
      return cmdScore(a);
    case 'leaderboard':
      return cmdLeaderboard(a);
    case 'run':
      return cmdRun(a);
    case 'abtest':
      return cmdAbtest(a);
    default:
      throw new Error(
        `unknown command: '${a.command}'. expected one of: probe, score, leaderboard, run, abtest`,
      );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runBenchmarkCli().catch((err) => {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}
