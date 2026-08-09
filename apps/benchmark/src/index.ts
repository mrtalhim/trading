export {
  probeDecisions,
  probeStats,
  computeCostUsd,
  type ProbeOptions,
  type ProbeResult,
  type ProbeStats,
} from './probe.js';
export {
  scoreProbes,
  computeWinRate,
  computeMaxDrawdown,
  type ScoreOptions,
  type ScoreResult,
} from './score.js';
export { buildLeaderboard, type Leaderboard, type LeaderboardRow } from './leaderboard.js';
export {
  forPairedBlocks,
  type BlockAnalysisOptions,
  type BlockDelta,
  type PairedAnalysisResult,
} from './paired.js';
export { runBenchmarkCli } from './cli.js';
export {
  mulberry32,
  randomDirectionStream,
  maCrossoverStream,
  runFixedBacktest,
  type RandomStreamOptions,
  type MaStreamOptions,
  type FixedBacktestConfig,
  type FixedBacktestOutcome,
} from './baseline.js';
export { envNameForPreset } from './cli.js';
export { parseArgs, parseContext } from './cli.js';
