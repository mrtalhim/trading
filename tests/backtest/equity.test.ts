import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { JsonlLoader } from '../../packages/datasets/src/index.js';
import {
  BacktestEngine,
  loadDecisions,
  type BacktestConfig,
} from '../../apps/backtest/src/index.js';

const GOLDEN = join(process.cwd(), 'datasets', 'golden', 'btc_15m');
const DECISIONS = join(process.cwd(), 'tests', 'replay', 'fixtures', 'btc-decisions.jsonl');

async function makeConfig(collectEquity?: boolean): Promise<BacktestConfig> {
  return {
    dataset: new JsonlLoader(GOLDEN),
    decisions: await loadDecisions(DECISIONS),
    symbol: 'BTC/USDT',
    base: 'BTC',
    quote: 'USDT',
    initialQuote: 10000,
    feeRate: 0.001,
    sizing: { fraction: 0.2 },
    atrStopMultiplier: 2,
    collectEquity,
  };
}

describe('BacktestEngine collectEquity (M8 support)', () => {
  it('default: no equityCurve in the result and the golden checksum is unchanged', async () => {
    const r = await new BacktestEngine(await makeConfig()).run();
    expect(r.equityCurve).toBeUndefined();
    expect(r.checksum).toBe('61040d1c35348318');
  });

  it('collectEquity: true → one mark-to-market entry per candle, all finite', async () => {
    const config = await makeConfig(true);
    const dataset = config.dataset;
    const r = await new BacktestEngine(config).run();

    expect(r.equityCurve).toBeDefined();
    expect(r.equityCurve).toHaveLength(r.candleCount);
    for (const point of r.equityCurve!) {
      expect(Number.isNaN(point.equity)).toBe(false);
      expect(Number.isFinite(point.equity)).toBe(true);
    }
    expect(r.equityCurve![0].timestamp).toBe(r.start);
    expect(r.equityCurve![r.equityCurve!.length - 1].timestamp).toBe(r.end);
    const last = r.equityCurve![r.equityCurve!.length - 1];
    expect(last.equity).toBeCloseTo(r.finalPortfolioValue, 6);
  });

  it('equity curve is deterministic across two runs', async () => {
    const r1 = await new BacktestEngine(await makeConfig(true)).run();
    const r2 = await new BacktestEngine(await makeConfig(true)).run();
    expect(r1.equityCurve).toEqual(r2.equityCurve);
    expect(await new JsonlLoader(GOLDEN).candles()[Symbol.asyncIterator]()).toBeTruthy();
  });
});
