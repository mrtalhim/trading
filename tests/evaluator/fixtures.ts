import {
  DecisionLogStore,
  type DecisionLogEntry,
  type DecisionTrade,
} from '../../packages/storage/src/index.js';
import type { EvaluatorConfig } from '../../apps/evaluator/src/index.js';

export const COST_MODELS = {
  'test-model': { promptPerMillionUsd: 1, completionPerMillionUsd: 2 },
};

export const USAGE = { promptTokens: 1000, completionTokens: 500, totalTokens: 1500 };

export function makeConfig(overrides: Partial<EvaluatorConfig> = {}): EvaluatorConfig {
  return {
    period: 'daily',
    logsDir: '',
    reportDir: '',
    controlRunDir: '',
    maxPauseMs: 86_400_000,
    minDecisions: 1,
    metricsSource: 'duckdb',
    costModels: COST_MODELS,
    benchmarks: {},
    llm: null,
    ...overrides,
  };
}

let seq = 0;

export function trade(partial: Partial<DecisionTrade> = {}): DecisionTrade {
  seq += 1;
  return {
    clientOrderId: `fx-${seq}`,
    side: 'buy',
    action: 'long',
    quantity: 1,
    price: 100,
    fee: 10,
    status: 'filled',
    realizedPnl: 0,
    ...partial,
  };
}

export function entry(partial: Partial<DecisionLogEntry> = {}): DecisionLogEntry {
  return {
    ts: 1_799_999_940_000,
    candleTimestamp: 1_799_999_940_000,
    pair: 'BTC/IDR',
    model: 'test-model',
    action: 'long',
    confidence: 0.8,
    invalidDecision: false,
    allowed: true,
    violated: [],
    pausedBy: null,
    price: 100,
    position: 0,
    realizedPnl: 0,
    fee: 0,
    tradeIds: [],
    trades: [],
    llmLatencyMs: 100,
    usage: USAGE,
    ...partial,
  };
}

export async function writeLog(dir: string, entries: DecisionLogEntry[]): Promise<string> {
  const store = new DecisionLogStore(dir);
  for (const e of entries) await store.append(e);
  return store.path();
}
