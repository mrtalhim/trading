import type { Dataset } from '@trading/datasets';
import { ReplayLoader } from '@trading/datasets';
import type { ContextKind, DecisionEngine, DecisionContext, CostModel, Usage } from '@trading/llm';
import type { LlmErrorKind } from '@trading/llm';
import { buildDecisionContext, classifyLlmError, contextOptionsFor } from '@trading/llm';
import type { Action } from '@trading/core';

export interface ProbeOptions {
  symbol: string;
  lookback: number;
  repeats: number;
  requestDelayMs: number;
  context: ContextKind;
}

export interface ProbeResult {
  timestamp: number;
  provider: string;
  validJson: boolean;
  /** null on success; one of the LlmErrorKind classes on failure. */
  errorKind: LlmErrorKind | null;
  /** Short provider-side error detail, present only on failure. */
  errorMessage?: string;
  action: Action | null;
  confidence: number | null;
  latencyMs: number;
  costUsd: number;
}

export interface ProbeStats {
  provider: string;
  samples: number;
  validJsonRate: number;
  meanLatencyMs: number;
  consistency: number;
  costUsd: number;
}

const DEFAULT_OPTIONS: ProbeOptions = {
  symbol: 'BTC/USDT',
  lookback: 20,
  repeats: 1,
  requestDelayMs: 0,
  context: 'baseline',
};

export async function probeDecisions(
  dataset: Dataset,
  engine: DecisionEngine,
  timestamps: number[],
  partialOptions?: Partial<ProbeOptions>,
): Promise<ProbeResult[]> {
  const opts = { ...DEFAULT_OPTIONS, ...partialOptions };
  const replay = new ReplayLoader(dataset);
  const candles = (await replay.all()).sort((a, b) => a.timestamp - b.timestamp);

  const results: ProbeResult[] = [];
  for (const ts of timestamps) {
    const idx = candles.findIndex((c) => c.timestamp === ts);
    if (idx < 0) {
      throw new Error(`timestamp ${ts} not found in dataset`);
    }
    const lookbackStart = Math.max(0, idx - opts.lookback + 1);
    const window = candles.slice(lookbackStart, idx + 1);
    const ctx = {
      ...buildDecisionContext(opts.symbol, window, contextOptionsFor(opts.context)),
      timestamp: ts,
    };

    for (let r = 0; r < opts.repeats; r++) {
      results.push(await probeOnce(engine, ctx, ts));
      if (opts.requestDelayMs > 0) {
        await sleep(opts.requestDelayMs);
      }
    }
  }
  return results;
}

async function probeOnce(
  engine: DecisionEngine,
  ctx: DecisionContext,
  timestamp: number,
): Promise<ProbeResult> {
  const started = performance.now();
  try {
    const { decision, usage } = engine.decideWithUsage
      ? await engine.decideWithUsage(ctx)
      : { decision: await engine.decide(ctx), usage: null };
    const latencyMs = performance.now() - started;
    return {
      timestamp,
      provider: engine.provider,
      validJson: true,
      errorKind: null,
      action: decision.action,
      confidence: decision.confidence,
      latencyMs,
      costUsd: computeCostUsd(usage, engine.costModel),
    };
  } catch (err) {
    const latencyMs = performance.now() - started;
    if (err instanceof Error) {
      return {
        timestamp,
        provider: engine.provider,
        validJson: false,
        errorKind: classifyLlmError(err),
        errorMessage: err.message.slice(0, 200),
        action: null,
        confidence: null,
        latencyMs,
        costUsd: 0,
      };
    }
    throw err;
  }
}

export function computeCostUsd(usage: Usage | null, costModel: CostModel | undefined): number {
  if (!usage || !costModel) return 0;
  return (
    (usage.promptTokens * costModel.promptPerMillionUsd +
      usage.completionTokens * costModel.completionPerMillionUsd) /
    1_000_000
  );
}

export function probeStats(probes: ProbeResult[]): ProbeStats {
  const byTimestamp = new Map<number, ProbeResult[]>();
  for (const p of probes) {
    const group = byTimestamp.get(p.timestamp) ?? [];
    group.push(p);
    byTimestamp.set(p.timestamp, group);
  }

  let consistentContexts = 0;
  for (const group of byTimestamp.values()) {
    const firstAction = group[0].action;
    const allSame = group.every(
      (p) => p.validJson && p.action !== null && p.action === firstAction,
    );
    if (allSame) consistentContexts++;
  }

  const samples = probes.length;
  const valid = probes.filter((p) => p.validJson).length;
  const latency = probes.reduce((sum, p) => sum + p.latencyMs, 0);
  const cost = probes.reduce((sum, p) => sum + p.costUsd, 0);

  return {
    provider: probes[0]?.provider ?? '',
    samples,
    validJsonRate: samples > 0 ? valid / samples : 0,
    meanLatencyMs: samples > 0 ? latency / samples : 0,
    consistency: byTimestamp.size > 0 ? consistentContexts / byTimestamp.size : 0,
    costUsd: cost,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
