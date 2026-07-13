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
