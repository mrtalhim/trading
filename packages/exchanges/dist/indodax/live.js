import ccxt from 'ccxt';
import { createIndodaxExchange } from './indodax-exchange.js';
/**
 * Builds the live adapter over a real `ccxt.indodax` client. Only the
 * authenticated methods are exercised here; the public and candle endpoints
 * go through `IndodaxPublicApiClient` instead.
 */
export function createLiveIndodax(config) {
    const client = new ccxt.indodax({
        apiKey: config.apiKey,
        secret: config.secret,
        enableRateLimit: config.enableRateLimit ?? true,
    });
    return {
        exchange: createIndodaxExchange(client),
        fetchServerTime: () => client.fetchTime(),
    };
}
//# sourceMappingURL=live.js.map