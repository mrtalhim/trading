import type { InternalBalance, InternalOrder } from '@trading/core';
export interface ReconcileInput {
    ownerId: string;
    recordedOrders: InternalOrder[];
    openOrders: InternalOrder[];
    balances: InternalBalance[];
    base: string;
    quote: string;
}
export interface ReconcileResult {
    unownedOpenOrders: InternalOrder[];
    newFills: InternalOrder[];
    missingOnExchange: InternalOrder[];
    position: number;
    quoteFree: number;
    consistent: boolean;
}
/**
 * Rebuilds the agent's view from exchange truth. Only orders carrying this
 * agent's `clientOrderId` prefix are owned; unowned open orders (manual
 * trades, other instances) are reported and never cancelled or counted.
 */
export declare function reconcile(input: ReconcileInput): ReconcileResult;
//# sourceMappingURL=reconcile.d.ts.map