import { type InternalBalance, type InternalOrder, type OrderParams, type Ticker } from '@trading/core';
import type { Exchange } from '../interfaces.js';
export interface PaperExchangeConfig {
    balances: Record<string, number>;
    feeRate?: number;
    /**
     * Full bid-ask spread in basis points (1 bps = 0.01%), applied symmetrically
     * around the mid price. Market buys fill at ask, market sells at bid. Default 0.
     */
    spreadBps?: number;
}
/**
 * In-memory simulated exchange. No network, no real API. Prices are pushed in
 * via {@link PaperExchange.updatePrice} (typically driven by the replay/backtest
 * price feed) and treated as the mid price. If a `spreadBps` is configured, the
 * ticker exposes a bid/ask around the mid and market orders cross the spread
 * (buys at ask, sells at bid). Limit orders fill when the relevant side of the
 * book crosses them, otherwise rest as open and reserve the required balance.
 */
export declare class PaperExchange implements Exchange {
    readonly name = "paper";
    private readonly feeRate;
    private readonly halfSpread;
    private readonly balances;
    private readonly lastPrice;
    private readonly positions;
    private readonly orders;
    private idCounter;
    constructor(config: PaperExchangeConfig);
    updatePrice(symbol: string, price: number, timestamp: number): void;
    private midPrice;
    private bidPrice;
    private askPrice;
    fetchTicker(symbol: string): Promise<Ticker>;
    fetchBalance(): Promise<InternalBalance[]>;
    createOrder(params: OrderParams): Promise<InternalOrder>;
    fetchOrder(clientOrderId: string): Promise<InternalOrder>;
    cancelOrder(clientOrderId: string): Promise<InternalOrder>;
    private reserve;
    private release;
    private applyFill;
    private matchLimitOrders;
    private move;
    private unmove;
    private rejected;
    private store;
}
export declare function createPaperExchange(config: PaperExchangeConfig): PaperExchange;
//# sourceMappingURL=paper-exchange.d.ts.map