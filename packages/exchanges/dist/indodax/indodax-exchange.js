import { defaultRetryPolicy, defaultSleep, executeCreateWithRecovery, executeWithRetry, mapBalance, mapOrder, mapTicker, } from './mapping.js';
/**
 * Indodax adapter over an injected CCXT client. The real `ccxt.indodax`
 * instance satisfies {@link CcxtLike}; tests inject a mock returning raw
 * CCXT-shaped responses. No network or live credentials are touched here.
 */
export class IndodaxExchange {
    api;
    policy;
    sleep;
    name = 'indodax';
    constructor(api, policy = defaultRetryPolicy, sleep = defaultSleep) {
        this.api = api;
        this.policy = policy;
        this.sleep = sleep;
    }
    async fetchTicker(symbol) {
        const raw = await executeWithRetry(() => this.api.fetchTicker(symbol), this.policy, this.sleep);
        return mapTicker(raw, symbol);
    }
    async fetchBalance() {
        const raw = await executeWithRetry(() => this.api.fetchBalance(), this.policy, this.sleep);
        return mapBalance(raw);
    }
    /**
     * ccxt's indodax wrapper derives the quote cost of a market buy from
     * `amount * price` and throws if no price is supplied. The engine normally
     * passes its reference price; when it doesn't, fall back to the live ticker
     * so a price-less market buy never reaches the wrapper in a broken state.
     */
    async resolvePrice(params) {
        if (params.price !== undefined)
            return params.price;
        if (!(params.type === 'market' && params.side === 'buy'))
            return undefined;
        const ticker = await this.api.fetchTicker(params.symbol);
        const last = ticker.last ?? ticker.close;
        if (typeof last !== 'number' || last <= 0) {
            throw new Error(`createOrder: no reference price for ${params.symbol} market buy (ticker has no usable last/close)`);
        }
        return last;
    }
    async createOrder(params) {
        const submit = async () => this.api.createOrder(params.symbol, params.type, params.side, params.quantity, await this.resolvePrice(params), { clientOrderId: params.clientOrderId });
        const lookup = (clientOrderId) => this.api.fetchOrder('', params.symbol, { clientOrderId });
        const raw = await executeCreateWithRecovery(submit, lookup, params.clientOrderId, this.policy, this.sleep);
        return mapOrder(raw, params.clientOrderId);
    }
    async fetchOrder(clientOrderId) {
        const raw = await executeWithRetry(() => this.api.fetchOrder('', undefined, { clientOrderId }), this.policy, this.sleep);
        return mapOrder(raw, clientOrderId);
    }
    async cancelOrder(clientOrderId) {
        const raw = await executeWithRetry(() => this.api.cancelOrder('', undefined, { clientOrderId }), this.policy, this.sleep);
        return mapOrder(raw, clientOrderId);
    }
}
export function createIndodaxExchange(api, policy, sleep) {
    return new IndodaxExchange(api, policy, sleep);
}
//# sourceMappingURL=indodax-exchange.js.map