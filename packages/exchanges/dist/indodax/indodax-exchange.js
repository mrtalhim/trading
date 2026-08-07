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
    async createOrder(params) {
        const submit = () => this.api.createOrder(params.symbol, params.type, params.side, params.quantity, params.price, {
            clientOrderId: params.clientOrderId,
        });
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