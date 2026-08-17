import { describe, expect, it, vi } from 'vitest';
import type { CcxtLike, CcxtLikeOrder } from '../indodax/mapping.js';
import { IndodaxExchange } from '../indodax/indodax-exchange.js';
import { defaultRetryPolicy } from '../indodax/mapping.js';

const SYMBOL = 'BTC/IDR';

function rawOrder(partial: Partial<CcxtLikeOrder> & { id: string }): CcxtLikeOrder {
  return {
    symbol: partial.symbol ?? SYMBOL,
    type: partial.type ?? 'market',
    side: partial.side ?? 'buy',
    price: partial.price ?? 100_000_000,
    amount: partial.amount ?? 0.5,
    filled: partial.filled ?? 0,
    remaining: partial.remaining ?? 0.5,
    status: partial.status ?? 'open',
    timestamp: partial.timestamp ?? 0,
    ...partial,
  };
}

function makeOrdersApi(open: CcxtLikeOrder[], closed: CcxtLikeOrder[]): CcxtLike {
  return {
    fetchTicker: async () => ({ symbol: SYMBOL, last: 100_000_000, timestamp: 0 }),
    fetchBalance: async () => ({ free: {}, used: {}, total: {} }),
    createOrder: async () => rawOrder({ id: 'tapi-x', status: 'closed', filled: 0.5 }),
    fetchOrder: async () => rawOrder({ id: 'tapi-x', status: 'closed', filled: 0.5 }),
    cancelOrder: async () => rawOrder({ id: 'tapi-x', status: 'canceled' }),
    fetchOpenOrders: async () => open,
    fetchClosedOrders: async () => closed,
  };
}

describe('IndodaxExchange open/closed order access (reconciliation source)', () => {
  it('fetchOpenOrders maps each raw order and preserves the exchange id', async () => {
    const api = makeOrdersApi([rawOrder({ id: 'tapi-1', status: 'open', amount: 0.5 })], []);
    const ex = new IndodaxExchange(
      api,
      defaultRetryPolicy,
      vi.fn(async () => {}),
    );
    const orders = await ex.fetchOpenOrders(SYMBOL);
    expect(orders).toHaveLength(1);
    expect(orders[0].id).toBe('tapi-1');
    expect(orders[0].clientOrderId).toBe('tapi-1');
    expect(orders[0].status).toBe('open');
    expect(orders[0].symbol).toBe(SYMBOL);
  });

  it('fetchClosedOrders maps closed history orders (orderHistory as trade-history proxy)', async () => {
    const api = makeOrdersApi(
      [],
      [rawOrder({ id: 'tapi-2', status: 'closed', filled: 0.5, average: 99_000_000 })],
    );
    const ex = new IndodaxExchange(
      api,
      defaultRetryPolicy,
      vi.fn(async () => {}),
    );
    const orders = await ex.fetchClosedOrders(SYMBOL);
    expect(orders).toHaveLength(1);
    expect(orders[0].id).toBe('tapi-2');
    expect(orders[0].clientOrderId).toBe('tapi-2');
    expect(orders[0].status).toBe('filled');
    expect(orders[0].filledQuantity).toBe(0.5);
    expect(orders[0].averagePrice).toBe(99_000_000);
  });

  it('returns an empty list for an empty exchange response', async () => {
    const ex = new IndodaxExchange(
      makeOrdersApi([], []),
      defaultRetryPolicy,
      vi.fn(async () => {}),
    );
    expect(await ex.fetchOpenOrders(SYMBOL)).toEqual([]);
    expect(await ex.fetchClosedOrders(SYMBOL)).toEqual([]);
  });

  it('retries fetchOpenOrders on 429 with backoff then succeeds', async () => {
    let calls = 0;
    const api: CcxtLike = {
      ...makeOrdersApi([], []),
      fetchOpenOrders: async () => {
        calls += 1;
        if (calls === 1) {
          const e = new Error('Too Many Requests') as Error & { httpStatus: number };
          e.httpStatus = 429;
          throw e;
        }
        return [rawOrder({ id: 'tapi-3', status: 'open' })];
      },
    };
    const sleep = vi.fn(async () => {});
    const ex = new IndodaxExchange(api, defaultRetryPolicy, sleep);
    const orders = await ex.fetchOpenOrders(SYMBOL);
    expect(orders).toHaveLength(1);
    expect(calls).toBe(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });
});
