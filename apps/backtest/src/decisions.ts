import { readFile } from 'node:fs/promises';
import type { Action } from '@trading/core';

export interface RecordedDecisionUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedTokens?: number;
  cacheCreationTokens?: number;
  staticTokenEstimate?: number;
}

export interface RecordedDecision {
  timestamp: number;
  action: Action;
  confidence: number;
  /** Model id that produced this decision (absent for synthetic/recorded inputs). */
  model?: string;
  /** Wall-clock latency of the LLM call, ms. */
  llmLatencyMs?: number;
  /** Token usage reported by the provider, when known. */
  usage?: RecordedDecisionUsage;
}

/**
 * Loads a recorded-decisions file. Supports either a JSON array
 * (`[{timestamp, action, confidence}, ...]`) or JSONL (one object per line).
 * Decisions are returned sorted ascending by timestamp for deterministic replay.
 */
export async function loadDecisions(path: string): Promise<RecordedDecision[]> {
  const raw = await readFile(path, 'utf-8');
  const parsed = parseDecisions(raw);
  return parsed.sort((a, b) => a.timestamp - b.timestamp);
}

function parseDecisions(raw: string): RecordedDecision[] {
  const trimmed = raw.trim();
  if (trimmed.startsWith('[')) {
    const arr = JSON.parse(trimmed) as unknown[];
    return arr.map(coerceDecision);
  }
  return trimmed
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => coerceDecision(JSON.parse(l)));
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function coerceDecision(value: unknown): RecordedDecision {
  if (typeof value !== 'object' || value === null) {
    throw new Error(`invalid decision entry: ${JSON.stringify(value)}`);
  }
  const v = value as Record<string, unknown>;
  if (typeof v.timestamp !== 'number') {
    throw new Error(`decision missing numeric timestamp: ${JSON.stringify(value)}`);
  }
  if (v.action !== 'long' && v.action !== 'short' && v.action !== 'hold') {
    throw new Error(`decision has invalid action: ${JSON.stringify(value)}`);
  }
  if (typeof v.confidence !== 'number' || v.confidence < 0 || v.confidence > 1) {
    throw new Error(`decision has invalid confidence: ${JSON.stringify(value)}`);
  }
  const decision: RecordedDecision = {
    timestamp: v.timestamp,
    action: v.action,
    confidence: v.confidence,
  };
  if (typeof v.model === 'string' && v.model.length > 0) {
    decision.model = v.model;
  }
  if (isFiniteNumber(v.llmLatencyMs) && v.llmLatencyMs >= 0) {
    decision.llmLatencyMs = v.llmLatencyMs;
  }
  if (typeof v.usage === 'object' && v.usage !== null) {
    const u = v.usage as Record<string, unknown>;
    if (
      isFiniteNumber(u.promptTokens) &&
      isFiniteNumber(u.completionTokens) &&
      isFiniteNumber(u.totalTokens)
    ) {
      decision.usage = {
        promptTokens: u.promptTokens,
        completionTokens: u.completionTokens,
        totalTokens: u.totalTokens,
      };
      for (const key of ['cachedTokens', 'cacheCreationTokens', 'staticTokenEstimate'] as const) {
        if (isFiniteNumber(u[key])) {
          decision.usage[key] = u[key];
        }
      }
    }
  }
  return decision;
}
