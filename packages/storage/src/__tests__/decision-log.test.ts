import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { readDecisionLogs } from '../decision-log.js';

function entryLine(overrides: Record<string, unknown>): string {
  return JSON.stringify({
    ts: 1777000000000,
    candleTimestamp: 1777000000000,
    pair: 'btc_idr',
    model: 'gemma4',
    action: 'hold',
    confidence: 0.5,
    invalidDecision: false,
    allowed: true,
    violated: [],
    pausedBy: null,
    price: 1,
    position: 0,
    realizedPnl: 0,
    fee: 0,
    tradeIds: [],
    trades: [],
    llmLatencyMs: 1000,
    usage: {
      promptTokens: 1700,
      completionTokens: 12,
      totalTokens: 1712,
    },
    ...overrides,
  });
}

async function parse(lines: string[]) {
  const path = join(tmpdir(), `decision-log-test-${Math.random().toString(36).slice(2)}.jsonl`);
  await writeFile(path, lines.join('\n') + '\n');
  return readDecisionLogs(path);
}

describe('readDecisionLogs with cache-metric usage', () => {
  it('parses legacy lines without the new usage fields', async () => {
    const { entries, skipped } = await parse([entryLine({})]);
    expect(skipped).toBe(0);
    expect(entries[0].usage).toEqual({
      promptTokens: 1700,
      completionTokens: 12,
      totalTokens: 1712,
    });
  });

  it('parses usage carrying cachedTokens and staticTokenEstimate', async () => {
    const { entries, skipped } = await parse([
      entryLine({
        usage: {
          promptTokens: 1700,
          completionTokens: 12,
          totalTokens: 1712,
          cachedTokens: 0,
          cacheCreationTokens: 0,
          staticTokenEstimate: 32,
        },
      }),
    ]);
    expect(skipped).toBe(0);
    expect(entries[0].usage).toEqual({
      promptTokens: 1700,
      completionTokens: 12,
      totalTokens: 1712,
      cachedTokens: 0,
      cacheCreationTokens: 0,
      staticTokenEstimate: 32,
    });
  });

  it('skips a malformed line without dropping valid neighbors', async () => {
    const { entries, skipped } = await parse([entryLine({}), 'not json', entryLine({})]);
    expect(skipped).toBe(1);
    expect(entries).toHaveLength(2);
  });
});
