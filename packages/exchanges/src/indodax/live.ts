import ccxt from 'ccxt';
import type { CcxtLike } from './mapping.js';
import { createIndodaxExchange, type IndodaxExchange } from './indodax-exchange.js';

export interface LiveIndodaxConfig {
  apiKey: string;
  secret: string;
  enableRateLimit?: boolean;
}

export interface LiveIndodax {
  exchange: IndodaxExchange;
  fetchServerTime: () => Promise<number>;
}

/**
 * Builds the live adapter over a real `ccxt.indodax` client. Only the
 * authenticated methods are exercised here; the public and candle endpoints
 * go through `IndodaxPublicApiClient` instead.
 */
export function createLiveIndodax(config: LiveIndodaxConfig): LiveIndodax {
  const client = new ccxt.indodax({
    apiKey: config.apiKey,
    secret: config.secret,
    enableRateLimit: config.enableRateLimit ?? true,
  }) as CcxtLike & { fetchTime(): Promise<number> };
  return {
    exchange: createIndodaxExchange(client),
    fetchServerTime: () => client.fetchTime(),
  };
}
