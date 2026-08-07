import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import type { Candle } from '@trading/core';
import { JsonlLoader, writeJsonlDataset } from '@trading/datasets';
import { IndodaxPublicApiClient, type HistoryBar } from '@trading/exchanges';
import { loadDecisions, type RecordedDecision } from '@trading/backtest';
import { AgentEngine } from './engine.js';
import type { AgentConfig } from './config.js';
import type { GuardrailConfig } from '@trading/guardrails';
import { statusPath, writeCommand, type AgentCommand } from './signal.js';

export const DEFAULT_DATASET = 'datasets/realistic/btc_idr_15m_2026';
export const DEFAULT_RUN_DIR = 'apps/indodax-agent/run';
export const DEFAULT_STATE_DIR = 'apps/indodax-agent/state';

interface CliArgs {
  command: string;
  options: Record<string, string>;
}

export function parseArgs(argv: string[]): CliArgs {
  let command = 'run';
  const options: Record<string, string> = {};
  let i = 0;
  while (i < argv.length) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = argv[i + 1];
      if (val !== undefined && !val.startsWith('--')) {
        options[key] = val;
        i += 2;
      } else {
        options[key] = 'true';
        i += 1;
      }
    } else {
      command = a;
      i += 1;
    }
  }
  return { command, options };
}

function num(opt: Record<string, string>, key: string, fallback: number): number {
  return opt[key] === undefined ? fallback : Number(opt[key]);
}

async function syntheticDecisions(
  candles: Candle[],
  sampleEvery: number,
): Promise<RecordedDecision[]> {
  const decisions: RecordedDecision[] = [];
  for (let i = sampleEvery; i < candles.length; i += sampleEvery) {
    decisions.push({
      timestamp: candles[i].timestamp,
      action: Math.floor(i / sampleEvery) % 2 === 0 ? 'long' : 'short',
      confidence: 0.95,
    });
  }
  return decisions;
}

async function pullDataset(opt: Record<string, string>): Promise<void> {
  const out = opt.out ?? DEFAULT_DATASET;
  const symbol = opt.symbol ?? 'BTCIDR';
  const tf = opt.tf ?? '15';
  const intervalS = Number(tf) * 60;
  const candles = num(opt, 'candles', 10020);
  const now = Math.floor(Date.now() / 1000);
  const from = now - (candles + 5) * intervalS;

  const client = new IndodaxPublicApiClient();
  const bars = await client.fetchHistory({ symbol, tf, from, to: now });

  const sorted: HistoryBar[] = [...bars].sort((a, b) => a.timestamp - b.timestamp).slice(-candles);
  const data: Candle[] = sorted.map((b) => ({
    timestamp: b.timestamp,
    open: b.open,
    high: b.high,
    low: b.low,
    close: b.close,
    volume: b.volume,
  }));
  const checksum = createHash('sha256').update(JSON.stringify(data)).digest('hex').slice(0, 16);
  const metadata = {
    exchange: 'indodax',
    pair: symbol.replace('IDR', '/IDR'),
    interval: `${tf}m`,
    timezone: 'UTC',
    source: 'indodax-public-api',
    start: data[0].timestamp,
    end: data[data.length - 1].timestamp,
    candleCount: data.length,
    checksum,
    includes: { candles: true, ticker: false, orderbook: false, trades: false },
  };
  await writeJsonlDataset(out, metadata, data);
  process.stdout.write(`wrote ${data.length} candles → ${out} (checksum ${checksum})\n`);
}

async function runAgent(opt: Record<string, string>): Promise<void> {
  const datasetDir = opt.dataset ?? DEFAULT_DATASET;
  const dataset = new JsonlLoader(datasetDir);
  const pins: Candle[] = [];
  for await (const c of dataset.candles()) pins.push(c);

  const decisions =
    opt.decisions !== undefined
      ? await loadDecisions(opt.decisions)
      : await syntheticDecisions(pins, num(opt, 'sampleEvery', 10));

  const pair = opt.pair ?? 'BTC/IDR';
  const [base = 'btc', quote = 'idr'] = pair.split('/');
  const guardrails: Partial<GuardrailConfig> = {};
  for (const key of [
    'maxPositionPercent',
    'dailyLossCap',
    'maxTradesPerHour',
    'minConfidence',
    'maxSpread',
    'minVolume',
    'atrSpikeThreshold',
    'maxCandleStalenessMs',
    'maxClockSkewMs',
    'maxLlmLatencyMs',
    'minBatteryPercent',
    'maxHeartbeatGapMs',
  ] as const) {
    if (opt[key] !== undefined) {
      (guardrails as Record<string, number>)[key] = Number(opt[key]);
    }
  }
  const config: AgentConfig = {
    mode: 'paper',
    pair,
    base,
    quote,
    interval: opt.interval ?? '15m',
    initialQuote: num(opt, 'cash', 10_000_000),
    feeRate: num(opt, 'feeRate', 0.002),
    sizing: {
      fraction: num(opt, 'fraction', 0.1),
      maxPositionFraction: num(opt, 'maxPositionFraction', 0.3),
    },
    atrStopMultiplier: num(opt, 'atrStopMultiplier', 2),
    guardrails,
    minNotionalIdr: num(opt, 'minNotionalIdr', 10_000),
    dailyBudgetIdr: num(opt, 'dailyBudgetIdr', 500_000_000),
    ownerId: opt.ownerId ?? 'agent-cli',
    runDir: opt.runDir ?? DEFAULT_RUN_DIR,
    stateDir: opt.stateDir ?? DEFAULT_STATE_DIR,
    reconcileEveryCandles: num(opt, 'reconcileEveryCandles', 250),
    commandCheckEveryCandles: num(opt, 'commandCheckEveryCandles', 25),
  };

  const engine = new AgentEngine(config);
  const result = await engine.run({ dataset, decisions });

  if (opt.out !== undefined) {
    await writeFile(opt.out, JSON.stringify(result, null, 2) + '\n');
  }
  process.stdout.write(
    `ran ${result.candleCount} candles, ${result.tradeCount} trades, ` +
      `realizedPnl ${result.realizedPnl.toFixed(2)} IDR, checksum ${result.checksum}\n`,
  );
}

async function sendCommand(opt: Record<string, string>, command: AgentCommand): Promise<void> {
  const runDir = opt?.runDir ?? DEFAULT_RUN_DIR;
  await writeCommand(runDir, command);
  process.stdout.write(`wrote command '${command}' → ${runDir}/command.json\n`);
}

async function showStatus(opt: Record<string, string>): Promise<void> {
  const runDir = opt?.runDir ?? DEFAULT_RUN_DIR;
  const path = statusPath(runDir);
  try {
    const raw = JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
    process.stdout.write(JSON.stringify(raw, null, 2) + '\n');
  } catch {
    process.stdout.write(`no status file at ${path}\n`);
  }
}

export async function runAgentCli(argv: string[] = process.argv.slice(2)): Promise<void> {
  const { command, options } = parseArgs(argv);
  switch (command) {
    case 'pull':
      await pullDataset(options);
      break;
    case 'run':
      await runAgent(options);
      break;
    case 'pause':
    case 'resume':
    case 'shutdown':
      await sendCommand(options, command);
      break;
    case 'status':
      await showStatus(options);
      break;
    default:
      throw new Error(
        `unknown command '${command}' (expected run|pull|pause|resume|shutdown|status)`,
      );
  }
}

// Allow direct execution: `node dist/cli.js ...`
if (import.meta.url === `file://${process.argv[1]}`) {
  runAgentCli().catch((err) => {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}
