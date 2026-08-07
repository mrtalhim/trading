import type { InternalBalance, InternalOrder } from '@trading/core';
import { isOwnedOrder } from './ownership.js';

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
export function reconcile(input: ReconcileInput): ReconcileResult {
  const unownedOpenOrders = input.openOrders.filter(
    (o) => !isOwnedOrder(o.clientOrderId, input.ownerId),
  );
  const ownedOpen = input.openOrders.filter((o) => isOwnedOrder(o.clientOrderId, input.ownerId));
  const ownedOpenIds = new Set(ownedOpen.map((o) => o.clientOrderId));
  const filledOnExchange = new Set(
    ownedOpen
      .filter((o) => o.status === 'filled' || o.status === 'partially_filled')
      .map((o) => o.clientOrderId),
  );

  const recordedById = new Map(input.recordedOrders.map((o) => [o.clientOrderId, o]));
  const newFills: InternalOrder[] = [];
  for (const id of filledOnExchange) {
    const recorded = recordedById.get(id);
    if (recorded && (recorded.status === 'open' || recorded.status === 'partially_filled')) {
      newFills.push(ownedOpen.find((o) => o.clientOrderId === id)!);
    }
  }

  const missingOnExchange = input.recordedOrders.filter(
    (o) =>
      (o.status === 'open' || o.status === 'partially_filled') &&
      !ownedOpenIds.has(o.clientOrderId),
  );

  const position = input.balances.find((b) => b.asset === input.base)?.total ?? 0;
  const quoteFree = input.balances.find((b) => b.asset === input.quote)?.free ?? 0;

  return {
    unownedOpenOrders,
    newFills,
    missingOnExchange,
    position,
    quoteFree,
    consistent: missingOnExchange.length === 0,
  };
}
