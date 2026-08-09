/**
 * `@trading/exchanges` — provider-agnostic exchange adapters.
 *
 * All adapters implement the {@link Exchange} interface and return the canonical
 * internal shapes defined in `@trading/core` (`Ticker`, `InternalBalance`,
 * `InternalOrder`). The paper adapter is a fully in-memory simulator (no
 * network). The Indodax adapter maps raw CCXT responses via pure functions and
 * is tested against mocked CCXT responses. Nothing in this package touches live
 * credentials or performs real trades.
 */

export type { Exchange } from './interfaces.js';
export { PaperExchange, createPaperExchange } from './paper/paper-exchange.js';
export type { PaperExchangeConfig } from './paper/paper-exchange.js';
export { IndodaxExchange, createIndodaxExchange } from './indodax/indodax-exchange.js';
export {
  type CcxtLike,
  type CcxtLikeTicker,
  type CcxtLikeBalance,
  type CcxtLikeOrder,
  type CcxtErrorKind,
  type RetryPolicy,
  type SleepFn,
  mapTicker,
  mapBalance,
  mapOrder,
  classifyCcxtError,
  CcxtFatalError,
  defaultRetryPolicy,
  executeWithRetry,
  executeCreateWithRecovery,
} from './indodax/mapping.js';
export {
  IndodaxPublicApiClient,
  normalizeHistorySymbol,
  normalizePairSymbol,
  parseDepth,
  parseHistoryBars,
  parsePairInfo,
  historyRetryPolicy,
  PublicApiError,
} from './indodax/public-api.js';
export type {
  FetchFn,
  HistoryV2Bar,
  HistoryBar,
  HistoryRequest,
  PairInfo,
  SearchSymbol,
  RetryPolicy as PublicRetryPolicy,
} from './indodax/public-api.js';
export { ClockSync } from './indodax/clock.js';
export type { FetchServerTime, NowFn } from './indodax/clock.js';
export { BudgetTracker, WIB_OFFSET_MS } from './indodax/budget.js';
export type { BudgetConfig, BudgetNowFn } from './indodax/budget.js';
export { buildClientOrderId, isOwnedOrder } from './indodax/ownership.js';
export { reconcile } from './indodax/reconcile.js';
export type { ReconcileInput, ReconcileResult } from './indodax/reconcile.js';
export { createLiveIndodax } from './indodax/live.js';
export type { LiveIndodax, LiveIndodaxConfig } from './indodax/live.js';
