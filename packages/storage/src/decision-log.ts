import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Action } from '@trading/core';
import { z } from 'zod';

export const DECISIONS_FILE = 'decisions.jsonl';

export function decisionLogPath(dir: string): string {
  return join(dir, DECISIONS_FILE);
}

export interface DecisionUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface DecisionTrade {
  clientOrderId: string;
  side: 'buy' | 'sell';
  action: Action;
  quantity: number;
  price: number;
  fee: number;
  status: string;
  realizedPnl: number;
}

export type PauseSource = 'manual' | 'evaluator' | null;

export interface DecisionLogEntry {
  ts: number;
  candleTimestamp: number;
  pair: string;
  model: string | null;
  action: Action;
  confidence: number;
  invalidDecision: boolean;
  allowed: boolean;
  violated: string[];
  pausedBy: PauseSource;
  price: number;
  position: number;
  realizedPnl: number;
  fee: number;
  tradeIds: string[];
  trades: DecisionTrade[];
  llmLatencyMs: number | null;
  usage: DecisionUsage | null;
}

export const decisionLogEntrySchema = z.object({
  ts: z.number(),
  candleTimestamp: z.number(),
  pair: z.string(),
  model: z.string().nullable(),
  action: z.enum(['long', 'short', 'hold']),
  confidence: z.number(),
  invalidDecision: z.boolean(),
  allowed: z.boolean(),
  violated: z.array(z.string()),
  pausedBy: z.enum(['manual', 'evaluator']).nullable(),
  price: z.number(),
  position: z.number(),
  realizedPnl: z.number(),
  fee: z.number(),
  tradeIds: z.array(z.string()),
  trades: z.array(
    z.object({
      clientOrderId: z.string(),
      side: z.enum(['buy', 'sell']),
      action: z.enum(['long', 'short', 'hold']),
      quantity: z.number(),
      price: z.number(),
      fee: z.number(),
      status: z.string(),
      realizedPnl: z.number(),
    }),
  ),
  llmLatencyMs: z.number().nullable(),
  usage: z
    .object({
      promptTokens: z.number(),
      completionTokens: z.number(),
      totalTokens: z.number(),
    })
    .nullable(),
});

export type DecisionLogEntryParsed = z.infer<typeof decisionLogEntrySchema>;

/**
 * Append-only JSONL writer for the per-decision log the runner produces and the
 * evaluator consumes. One line per decision cycle.
 */
export class DecisionLogStore {
  constructor(private readonly dir: string) {}

  path(): string {
    return decisionLogPath(this.dir);
  }

  async append(entry: DecisionLogEntry): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    await appendFile(this.path(), JSON.stringify(entry) + '\n', 'utf8');
  }
}

export interface DecisionLogReadResult {
  entries: DecisionLogEntry[];
  skipped: number;
}

/**
 * Reads a decisions.jsonl file. Tolerant: malformed lines are counted and
 * skipped so a single corrupt line never takes down the evaluator. A missing
 * file yields an empty result.
 */
export async function readDecisionLogs(path: string): Promise<DecisionLogReadResult> {
  const raw = await readFile(path, 'utf8').catch(() => '');
  const entries: DecisionLogEntry[] = [];
  let skipped = 0;
  for (const line of raw.split('\n')) {
    if (line.trim() === '') continue;
    try {
      const parsed = decisionLogEntrySchema.parse(JSON.parse(line));
      entries.push(parsed);
    } catch {
      skipped += 1;
    }
  }
  return { entries, skipped };
}
