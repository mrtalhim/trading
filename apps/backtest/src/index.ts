export {
  BacktestEngine,
  loadDataset,
  type BacktestConfig,
  type BacktestResult,
  type TradeRecord,
  type OutcomeRecord,
} from './engine.js';
export { loadDecisions, type RecordedDecision } from './decisions.js';
export { runBacktestCli } from './cli.js';
