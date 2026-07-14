import { join } from 'node:path';
import { BacktestEngine, loadDataset, loadDecisions } from '../apps/backtest/dist/index.js';

const GOLDEN = join(process.cwd(), 'datasets', 'golden', 'btc_15m');
const DECISIONS = join(process.cwd(), 'tests', 'replay', 'fixtures', 'btc-decisions.jsonl');

const dataset = loadDataset(GOLDEN);
const decisions = await loadDecisions(DECISIONS);

const config = {
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
process.stdout.write(JSON.stringify({ checksum: result.checksum }, null, 2) + '\n');
