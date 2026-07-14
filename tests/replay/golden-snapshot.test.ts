import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { JsonlLoader } from '../../packages/datasets/src/index.js';
import {
  BacktestEngine,
  loadDecisions,
  type BacktestConfig,
} from '../../apps/backtest/src/index.js';

const GOLDEN = join(process.cwd(), 'datasets', 'golden', 'btc_15m');
const DECISIONS = join(process.cwd(), 'tests', 'replay', 'fixtures', 'btc-decisions.jsonl');
const BASELINE = join(process.cwd(), 'tests', 'replay', 'baseline.btc.json');

async function runGolden(): Promise<string> {
  const dataset = new JsonlLoader(GOLDEN);
  const decisions = await loadDecisions(DECISIONS);
  const config: BacktestConfig = {
    dataset,
    decisions,
    symbol: 'BTC/USDT',
    base: 'BTC',
    quote: 'USDT',
    initialQuote: 10000,
    feeRate: 0.001,
    sizing: { fraction: 0.2 },
    atrStopMultiplier: 2,
  };
  const result = await new BacktestEngine(config).run();
  return result.checksum;
}

describe('Golden dataset replay (M6 drift guard)', () => {
  it('matches the committed baseline checksum', async () => {
    const checksum = await runGolden();
    const baselineRaw = await readFile(BASELINE, 'utf-8');
    const baseline = JSON.parse(baselineRaw) as { checksum: string };
    expect(checksum).toBe(baseline.checksum);
  });
});
