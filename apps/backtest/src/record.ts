import { writeFile } from 'node:fs/promises';
import type { Dataset } from '@trading/datasets';
import { ReplayLoader } from '@trading/datasets';
import type { ContextKind, DecisionEngine, Usage } from '@trading/llm';
import {
  contextOptionsFor,
  safeDecide,
  classifyLlmError,
  buildDecisionContext,
} from '@trading/llm';
import type { RecordedDecision } from './decisions.js';

export interface RecordOptions {
  lookback: number;
  sampleEvery: number;
  symbol: string;
  requestDelayMs: number;
  context: ContextKind;
  /** Model id stamped into each recorded decision (used by the evaluator for cost). */
  model?: string;
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
  const renderOpts = contextOptionsFor(opts.context);

  for (let i = 0; i < allCandles.length; i++) {
    if (i % opts.sampleEvery !== 0) continue;

    const lookbackStart = Math.max(0, i - opts.lookback + 1);
    const recentCandles = allCandles.slice(lookbackStart, i + 1);
    const ts = allCandles[i].timestamp;
    // Orderflow block reads the snapshot keyed to the decision candle's close.
    const book = renderOpts.includeOrderflow ? ((await dataset.orderbook?.(ts)) ?? null) : null;
    const ctx = buildDecisionContext(opts.symbol, recentCandles, renderOpts, book);

    const startedAt = Date.now();
    const decision = await decideWithLatency(engine, {
      ...ctx,
      timestamp: ts,
    });
    const llmLatencyMs = Date.now() - startedAt;

    decisions.push({
      timestamp: ts,
      action: decision.decision.action,
      confidence: decision.decision.confidence,
      model: opts.model,
      usage: decision.usage ?? undefined,
      llmLatencyMs,
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

interface DecisionWithLatency {
  decision: { action: 'long' | 'short' | 'hold'; confidence: number };
  usage: Usage | null;
}

async function decideWithLatency(
  engine: DecisionEngine,
  ctx: { systemPrompt: string; userPrompt: string; timestamp?: number },
): Promise<DecisionWithLatency> {
  if (typeof engine.decideWithUsage === 'function') {
    try {
      const result = await engine.decideWithUsage(ctx);
      return { decision: result.decision, usage: result.usage };
    } catch (err) {
      console.error(
        err instanceof Error
          ? `[${classifyLlmError(err)}] ${err.message}`
          : `[fatal] ${String(err)}`,
      );
      return { decision: { action: 'hold', confidence: 0 }, usage: null };
    }
  }
  return { decision: await safeDecide(engine, ctx), usage: null };
}
