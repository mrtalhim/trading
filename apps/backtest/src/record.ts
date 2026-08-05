import { writeFile } from 'node:fs/promises';
import type { Candle } from '@trading/core';
import type { Dataset } from '@trading/datasets';
import { ReplayLoader } from '@trading/datasets';
import type { DecisionEngine } from '@trading/llm';
import { safeDecide } from '@trading/llm';
import type { RecordedDecision } from './decisions.js';

export interface RecordOptions {
  lookback: number;
  sampleEvery: number;
  symbol: string;
  requestDelayMs: number;
}

const DEFAULT_OPTIONS: RecordOptions = {
  lookback: 20,
  sampleEvery: 1,
  symbol: 'BTC/USDT',
  requestDelayMs: 3500,
};

function buildSystemPrompt(symbol: string): string {
  return [
    'You are a crypto trading decision engine.',
    `You trade ${symbol}.`,
    '',
    'Rules:',
    '- You must respond with EXACTLY a JSON object: {"action":"long"|"short"|"hold","confidence":0.0-1.0}',
    '- action: "long" = buy, "short" = sell, "hold" = do nothing',
    '- confidence: your certainty in this decision (0.0 to 1.0)',
    '- No other text, no markdown fences, just the raw JSON object.',
    '',
    'Consider the recent price action, volume, and trend.',
  ].join('\n');
}

function buildUserPrompt(recentCandles: Candle[]): string {
  const lines = recentCandles.map(
    (c) => `t=${c.timestamp} O=${c.open} H=${c.high} L=${c.low} C=${c.close} V=${c.volume}`,
  );
  return [
    'Recent candles (oldest first):',
    ...lines,
    '',
    'Based on this price action, what is your decision?',
    'Respond with exactly: {"action":"long"|"short"|"hold","confidence":0.0-1.0}',
  ].join('\n');
}

export async function recordDecisions(
  dataset: Dataset,
  engine: DecisionEngine,
  partialOptions?: Partial<RecordOptions>,
): Promise<RecordedDecision[]> {
  const opts = { ...DEFAULT_OPTIONS, ...partialOptions };
  const systemPrompt = buildSystemPrompt(opts.symbol);
  const replay = new ReplayLoader(dataset);
  const allCandles = await replay.all();

  allCandles.sort((a, b) => a.timestamp - b.timestamp);
  const decisions: RecordedDecision[] = [];

  for (let i = 0; i < allCandles.length; i++) {
    if (i % opts.sampleEvery !== 0) continue;

    const lookbackStart = Math.max(0, i - opts.lookback + 1);
    const recentCandles = allCandles.slice(lookbackStart, i + 1);
    const userPrompt = buildUserPrompt(recentCandles);

    const decision = await safeDecide(engine, {
      systemPrompt,
      userPrompt,
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
