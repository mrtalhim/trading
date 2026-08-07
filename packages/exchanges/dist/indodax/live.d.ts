import { type IndodaxExchange } from './indodax-exchange.js';
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
export declare function createLiveIndodax(config: LiveIndodaxConfig): LiveIndodax;
//# sourceMappingURL=live.d.ts.map