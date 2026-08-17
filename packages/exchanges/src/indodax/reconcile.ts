import type { InternalBalance, InternalOrder } from '@trading/core';
import { isOwnedOrder } from './ownership.js';

export interface ReconcileInput {
  ownerId: string;
  recordedOrders: InternalOrder[];
  openOrders: InternalOrder[];
  closedOrders: InternalOrder[];
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
 * Rebuilds the agent's view from exchange truth. Ownership is established two
 * ways: orders carrying this agent's `clientOrderId` prefix (`AG-<owner>-…`),
 * or any order whose exchange id matches a recorded order's `id`. The second
 * path exists because tapi never returns a client-order-id — the exchange id
 * captured at create time is the only durable link between a live order and
 * our records. Unowned open orders (manual trades, other instances) are
 * reported and never cancelled or counted.
 *
 * Fills are detected from owned orders present as filled in `openOrders` and
 * from recorded open orders that appear closed-and-filled in `closedOrders`
 * (orderHistory — the ccxt-available proxy for the missing trade_history
 * surface). `missingOnExchange` is drift only when a recorded open order is
 * absent from both surfaces.
 */
export function reconcile(input: ReconcileInput): ReconcileResult {
  const recordedByClientId = new Map(input.recordedOrders.map((o) => [o.clientOrderId, o]));
  const recordedByExchangeId = new Map(
    input.recordedOrders.filter((o) => o.id).map((o) => [o.id, o]),
  );

  const isOwned = (o: InternalOrder): boolean =>
    isOwnedOrder(o.clientOrderId, input.ownerId) || (o.id !== '' && recordedByExchangeId.has(o.id));

  const ownedOpen = input.openOrders.filter(isOwned);
  const unownedOpenOrders = input.openOrders.filter((o) => !isOwned(o));

  const recordedFor = (o: InternalOrder): InternalOrder | undefined =>
    recordedByClientId.get(o.clientOrderId) ?? (o.id ? recordedByExchangeId.get(o.id) : undefined);

  const seen = new Set<string>();
  const newFills: InternalOrder[] = [];
  const consider = (o: InternalOrder): void => {
    const key = `${o.clientOrderId}::${o.id}`;
    if (seen.has(key)) return;
    const recorded = recordedFor(o);
    if (!recorded) return;
    const recordedOpen = recorded.status === 'open' || recorded.status === 'partially_filled';
    const exchangeClosed = o.status === 'filled' || o.status === 'partially_filled';
    if (!recordedOpen || !exchangeClosed) return;
    seen.add(key);
    newFills.push(o);
  };

  for (const o of ownedOpen) consider(o);
  for (const o of input.closedOrders) consider(o);

  const present = new Set<string>();
  for (const o of [...ownedOpen, ...input.closedOrders]) {
    present.add(o.clientOrderId);
    if (o.id) present.add(o.id);
  }

  const missingOnExchange = input.recordedOrders.filter(
    (o) =>
      (o.status === 'open' || o.status === 'partially_filled') &&
      !present.has(o.clientOrderId) &&
      !(o.id !== '' && present.has(o.id)),
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
