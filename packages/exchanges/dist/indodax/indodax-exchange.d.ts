import type { InternalBalance, InternalOrder, OrderParams, Ticker } from '@trading/core';
import type { Exchange } from '../interfaces.js';
import { type CcxtLike, type RetryPolicy, type SleepFn } from './mapping.js';
/**
 * Indodax adapter over an injected CCXT client. The real `ccxt.indodax`
 * instance satisfies {@link CcxtLike}; tests inject a mock returning raw
 * CCXT-shaped responses. No network or live credentials are touched here.
 */
export declare class IndodaxExchange implements Exchange {
    private readonly api;
    private readonly policy;
    private readonly sleep;
    readonly name = "indodax";
    constructor(api: CcxtLike, policy?: RetryPolicy, sleep?: SleepFn);
    fetchTicker(symbol: string): Promise<Ticker>;
    fetchBalance(): Promise<InternalBalance[]>;
    /**
     * ccxt's indodax wrapper derives the quote cost of a market buy from
     * `amount * price` and throws if no price is supplied. The engine normally
     * passes its reference price; when it doesn't, fall back to the live ticker
     * so a price-less market buy never reaches the wrapper in a broken state.
     */
    private resolvePrice;
    createOrder(params: OrderParams): Promise<InternalOrder>;
    fetchOrder(clientOrderId: string): Promise<InternalOrder>;
    cancelOrder(clientOrderId: string): Promise<InternalOrder>;
}
export declare function createIndodaxExchange(api: CcxtLike, policy?: RetryPolicy, sleep?: SleepFn): IndodaxExchange;
//# sourceMappingURL=indodax-exchange.d.ts.map