import { describe, expect, it } from 'vitest';
import type { InternalBalance, InternalOrder } from '@trading/core';
import { reconcile, type ReconcileInput } from '../indodax/reconcile.js';

function order(partial: Partial<InternalOrder> & { clientOrderId: string }): InternalOrder {
  return {
    id: partial.id ?? partial.clientOrderId,
    symbol: partial.symbol ?? 'BTC/IDR',
    side: partial.side ?? 'buy',
    type: partial.type ?? 'limit',
    price: partial.price ?? null,
    quantity: partial.quantity ?? 1,
    filledQuantity: partial.filledQuantity ?? 0,
    averagePrice: partial.averagePrice ?? null,
    status: partial.status ?? 'open',
    timestamp: partial.timestamp ?? 1_000_000,
    clientOrderId: partial.clientOrderId,
  };
}

function balance(asset: string, free: number, total: number): InternalBalance {
  return { asset, free, used: total - free, total };
}

function input(partial: Partial<ReconcileInput>): ReconcileInput {
  return {
    ownerId: 'abc123',
    recordedOrders: [],
    openOrders: [],
    balances: [balance('idr', 5_000_000, 5_000_000), balance('btc', 0, 0)],
    base: 'btc',
    quote: 'idr',
    ...partial,
  };
}

describe('reconcile (ownership + startup/periodic)', () => {
  it('reports unowned open orders without touching them', () => {
    const unowned = order({ clientOrderId: 'manual-1', side: 'sell' });
    const result = reconcile(input({ openOrders: [unowned] }));
    expect(result.unownedOpenOrders).toEqual([unowned]);
    expect(result.newFills).toEqual([]);
    expect(result.missingOnExchange).toEqual([]);
    expect(result.consistent).toBe(true);
  });

  it('detects fills of owned orders that closed on the exchange', () => {
    const recorded = order({ clientOrderId: 'AG-abc123-1', status: 'open' });
    const filled = order({ clientOrderId: 'AG-abc123-1', status: 'filled', filledQuantity: 1 });
    const result = reconcile(
      input({ recordedOrders: [recorded], openOrders: [filled], balances: [balance('btc', 1, 1)] }),
    );
    expect(result.newFills).toEqual([filled]);
    expect(result.position).toBe(1);
  });

  it('flags owned orders recorded as open but missing on the exchange as drift', () => {
    const recorded = order({ clientOrderId: 'AG-abc123-3', status: 'open' });
    const result = reconcile(input({ recordedOrders: [recorded] }));
    expect(result.missingOnExchange).toEqual([recorded]);
    expect(result.consistent).toBe(false);
  });

  it('derives position and quoteFree from balances', () => {
    const result = reconcile(
      input({ balances: [balance('idr', 3_000_000, 3_000_000), balance('btc', 0.5, 2)] }),
    );
    expect(result.position).toBe(2);
    expect(result.quoteFree).toBe(3_000_000);
  });

  it('simulated restart: fills are reconciled exactly once, no duplicates', () => {
    const recorded = [
      order({ clientOrderId: 'AG-abc123-1', status: 'open' }),
      order({ clientOrderId: 'AG-abc123-2', status: 'filled', filledQuantity: 0.5 }),
    ];
    const exchangeOpen = [
      order({ clientOrderId: 'AG-abc123-1', status: 'filled', filledQuantity: 1 }),
      order({ clientOrderId: 'AG-abc123-2', status: 'filled', filledQuantity: 0.5 }),
    ];
    const result = reconcile(
      input({
        recordedOrders: recorded,
        openOrders: exchangeOpen,
        balances: [balance('idr', 1_000_000, 1_000_000), balance('btc', 1.5, 1.5)],
      }),
    );
    expect(result.newFills).toHaveLength(1);
    expect(result.newFills[0].clientOrderId).toBe('AG-abc123-1');
    expect(result.position).toBe(1.5);
    const recordedIds = new Set(recorded.map((o) => o.clientOrderId));
    const everyFillKnown = result.newFills.every((f) => recordedIds.has(f.clientOrderId));
    expect(everyFillKnown).toBe(true);
  });
});
