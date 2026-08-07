import type { InternalBalance, InternalOrder, OrderParams, Ticker } from '@trading/core';
/**
 * Provider-agnostic exchange adapter contract. Every adapter (paper, indodax,
 * future venues) implements this interface and returns the canonical internal
 * shapes defined in `@trading/core`. Adapters are pure mappings over an
 * injected API client — never mock your own wrapper.
 */
export interface Exchange {
    readonly name: string;
    fetchTicker(symbol: string): Promise<Ticker>;
    fetchBalance(): Promise<InternalBalance[]>;
    createOrder(params: OrderParams): Promise<InternalOrder>;
    fetchOrder(clientOrderId: string): Promise<InternalOrder>;
    cancelOrder(clientOrderId: string): Promise<InternalOrder>;
}
//# sourceMappingURL=interfaces.d.ts.map