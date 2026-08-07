import { writeFile } from 'node:fs/promises';
import type { Dataset } from '@trading/datasets';
import { ReplayLoader } from '@trading/datasets';
import type { ContextKind, DecisionEngine } from '@trading/llm';
import { contextOptionsFor, safeDecide, buildDecisionContext } from '@trading/llm';
import type { RecordedDecision } from './decisions.js';

export interface RecordOptions {
  lookback: number;
  sampleEvery: number;
  symbol: string;
  requestDelayMs: number;
  context: ContextKind;
}

const DEFAULT_OPTIONS: RecordOptions = {
  lookback: 20,
  sampleEvery: 1,
  symbol: 'BTC/USDT',
  requestDelayMs: 3500,
  context: 'baseline',
};

export async function recordDecisions(
  dataset: Dataset,
  engine: DecisionEngine,
  partialOptions?: Partial<RecordOptions>,
): Promise<RecordedDecision[]> {
  const opts = { ...DEFAULT_OPTIONS, ...partialOptions };
  const replay = new ReplayLoader(dataset);
  const allCandles = await replay.all();

  allCandles.sort((a, b) => a.timestamp - b.timestamp);
  const decisions: RecordedDecision[] = [];

  for (let i = 0; i < allCandles.length; i++) {
    if (i % opts.sampleEvery !== 0) continue;

    const lookbackStart = Math.max(0, i - opts.lookback + 1);
    const recentCandles = allCandles.slice(lookbackStart, i + 1);
    const ctx = buildDecisionContext(opts.symbol, recentCandles, contextOptionsFor(opts.context));

    const decision = await safeDecide(engine, {
      ...ctx,
      timestamp: allCandles[i].timestamp,
    });

    decisions.push({
      timestamp: allCandles[i].timestamp,
      action: decision.action,
      confidence: decision.confidence,
    });

    if (i + opts.sampleEvery < allCandles.length) {
      await sleep(opts.requestDelayMs);
    }
  }

  return decisions;
}

export async function writeDecisions(
  decisions: RecordedDecision[],
  outputPath: string,
): Promise<void> {
  const lines = decisions.map((d) => JSON.stringify(d));
  await writeFile(outputPath, lines.join('\n') + '\n');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
